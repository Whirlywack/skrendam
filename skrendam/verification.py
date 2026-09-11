"""Re-confirm published deals and candidates against a fresh flights search.

Two consumers share this module:

* ``verify_deal`` + ``transition`` — the daily scan's live-deal verification step (WP9, spec
  ``docs/plans/2026-09-11-live-deal-verification-spec.md`` §3–4). ``verify_deal`` prices the
  deal's EXACT itinerary (matched by flight numbers) with one flights call; ``transition`` is
  the pure state machine that decides ``live`` / ``changed`` / ``expired``.
* ``recheck_candidate`` — the desk's manual recheck button (spec §6 verification_checks).

Empty search results never expire deals on their own: during a gated fli window an empty result
means the pipe is blocked, not that the fare is gone (fli-resilience spec). Only two consecutive
empty answers on healthy runs, a real price that fails the deal gate, the date sweep, or a curator
action take a deal off the site.
"""

from dataclasses import dataclass
from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.scanning.scoring.eligibility import Gates, gates_for, price_anomaly_ok

__all__ = [
    "EXACT_CHECK_MAX_AGE_DAYS",
    "GOING_FAST_RISE",
    "LIVE_STATUSES",
    "MISSED_CHECKS_TO_EXPIRE",
    "PRICE_DRIFT_TOLERANCE_PCT",
    "VERIFY_CALLS_PER_DAY",
    "DealCheck",
    "Decision",
    "Gates",
    "gates_for",
    "price_anomaly_ok",
    "recheck_candidate",
    "record_check",
    "transition",
    "verify_deal",
]

GOING_FAST_RISE = (
    0.05  # a recheck price >= published price * (1 + this) is an observed "going fast"
)

# WP9 verification constants (plan 2026-09-11, Global Constraints).
PRICE_DRIFT_TOLERANCE_PCT = 10  # live while current <= published * 1.10
MISSED_CHECKS_TO_EXPIRE = 2  # consecutive empty answers on HEALTHY runs before expiry
EXACT_CHECK_MAX_AGE_DAYS = 3  # an exact check is due when verified_at is older than this
VERIFY_CALLS_PER_DAY = 20  # cap on flights calls the verification step may spend
# Statuses the site and the desk show as "on the site"; mirrored byte-for-byte in site + web.
LIVE_STATUSES = ("live", "changed")


@dataclass(frozen=True)
class DealCheck:
    """One answer from Google about a published deal.

    ``available=False`` is an empty answer (every price None). ``available=True`` with
    ``price=None`` means the day still had fares but the exact itinerary was not among them;
    ``window_min_*`` is then the cheapest fare that day. ``checked_at`` is the run's ``now``,
    written to ``deal_price_checks.checked_at``.
    """

    available: bool
    price: float | None
    window_min_price: float | None
    window_min_date: date | None
    source: str  # 'flights' | 'calendar' | 'manual'
    checked_at: datetime


@dataclass(frozen=True)
class Decision:
    """What ``transition`` decided; the caller persists it.

    ``expired_at`` is midnight of ``today`` when the status becomes ``expired`` (the caller may
    overwrite it with the run's ``now``), else None. ``reason`` is a short machine tag.
    """

    status: str
    missed_checks: int
    expired_at: datetime | None
    reason: str


def _flight_numbers(legs) -> tuple[str, ...]:
    out = []
    for leg in legs or ():
        number = leg.get("flight_number") if isinstance(leg, dict) else None
        out.append("".join(str(number or "").split()).upper())
    return tuple(out)


def verify_deal(
    deal: models.PublishedDeal,
    adapter: FliAdapter,
    *,
    now: datetime,
    snapshot: dict | None = None,
    cabin: str = "ECONOMY",
) -> DealCheck:
    """Price a published deal's exact itinerary with ONE flights call.

    ``snapshot`` is the candidate's ``itinerary_snapshot`` (``legs[].flight_number``); the exact
    itinerary is the fare whose legs' flight numbers equal the snapshot's, in order. Without a
    snapshot the itinerary cannot be identified, so ``price`` is None and only the day minimum
    is reported. A ``ScanError`` propagates: an error is no evidence and must not count as an
    empty answer.
    """
    fares = adapter.search_flights(
        deal.origin, deal.destination, deal.travel_date, deal.return_date, cabin
    )
    return _check_from_fares(
        fares, snapshot=snapshot, travel_date=deal.travel_date, source="flights", now=now
    )


def _check_from_fares(fares, *, snapshot: dict | None, travel_date, source: str, now) -> DealCheck:
    """Turn one flights answer into a ``DealCheck`` (shared by the scan and the desk Recheck)."""
    if not fares:
        return DealCheck(False, None, None, None, source, now)
    wanted = _flight_numbers((snapshot or {}).get("legs"))
    exact = None
    if wanted and all(wanted):
        exact = next((f for f in fares if _flight_numbers(f.legs) == wanted), None)
    cheapest = min(fares, key=lambda f: f.price)
    return DealCheck(
        available=True,
        price=exact.price if exact is not None else None,
        window_min_price=cheapest.price,
        window_min_date=travel_date,
        source=source,
        checked_at=now,
    )


def transition(
    deal: models.PublishedDeal,
    check: DealCheck,
    *,
    gates: Gates,
    today: date,
    run_healthy: bool,
) -> Decision:
    """Pure spec-§4 state machine; the caller persists the Decision.

    "Still a deal" is discovery's own price predicate (``price_anomaly_ok`` against the frozen
    ``baseline_price``), so a price that would be published today is never expired. The
    calendar rule (travel date passed) stays in the orchestrator's date sweep.
    """
    unchanged = Decision(deal.status, deal.missed_checks, None, "not_live")
    if deal.status not in LIVE_STATUSES:
        return unchanged
    expired_at = datetime.combine(today, time.min)

    if not check.available:
        missed = deal.missed_checks + 1 if run_healthy else deal.missed_checks
        if missed >= MISSED_CHECKS_TO_EXPIRE:
            return Decision("expired", missed, expired_at, "missing_2_days")
        return Decision(deal.status, missed, None, "empty")

    if check.price is not None:
        if check.price <= deal.price * (1 + PRICE_DRIFT_TOLERANCE_PCT / 100):
            return Decision("live", 0, None, "within_tolerance")
        if price_anomaly_ok(check.price, deal.baseline_price, gates):
            return Decision("changed", 0, None, "price_drift")
        return Decision("expired", 0, expired_at, "gate_failed")

    if check.window_min_price is None:
        return Decision(deal.status, deal.missed_checks, None, "no_price")
    # The exact itinerary could not be identified, but the day's cheapest fare on
    # those dates is within tolerance of the published price: nothing changed for
    # the reader (review fix round 1 — a snapshot without flight numbers, or an
    # itinerary that merely dropped out of the list, must not flip a deal).
    if check.window_min_price <= deal.price * (1 + PRICE_DRIFT_TOLERANCE_PCT / 100):
        return Decision("live", 0, None, "within_tolerance")
    if price_anomaly_ok(check.window_min_price, deal.baseline_price, gates):
        return Decision("changed", 0, None, "itinerary_gone")
    return Decision("expired", 0, expired_at, "gate_failed")


def record_check(
    session: Session,
    deal: models.PublishedDeal,
    check: DealCheck,
    *,
    gates: Gates,
    today: date,
    run_healthy: bool,
    now: datetime,
    run_id: int | None,
) -> Decision:
    """Persist one check: the ``deal_price_checks`` row, the verification fields, the transition.

    The single writer for both the daily step (``run_id`` set) and the desk's Recheck
    (``source='manual'``, ``run_id`` None), so the two never drift. A real answer stamps
    ``current_price`` (the exact itinerary, else the day's cheapest fare — a ``changed``
    deal must never carry a NULL current price), ``window_min_*``, ``verified_at`` and
    ``last_seen_at``; an empty one only marks ``unverified_since``. ``expired_at`` is the
    caller's wall clock, not midnight.
    """
    decision = transition(deal, check, gates=gates, today=today, run_healthy=run_healthy)
    session.add(
        models.DealPriceCheck(
            deal_id=deal.id,
            checked_at=check.checked_at,
            source=check.source,
            available=check.available,
            price=check.price,
            window_min_price=check.window_min_price,
            window_min_date=check.window_min_date,
            run_id=run_id,
        )
    )
    if check.available:
        deal.current_price = check.price if check.price is not None else check.window_min_price
        deal.current_price_at = now
        deal.window_min_price = check.window_min_price
        deal.window_min_date = check.window_min_date
        deal.verified_at = now
        deal.last_seen_at = now
        deal.unverified_since = None
    elif deal.unverified_since is None:
        deal.unverified_since = now
    deal.status = decision.status
    deal.missed_checks = decision.missed_checks
    if decision.expired_at is not None:
        deal.expired_at = now
    return decision


def _update_published_for_candidate(
    session: Session, candidate: models.Candidate, fares, now: datetime
) -> None:
    """Propagate a manual recheck answer to the candidate's visible published deals.

    A real answer is the same evidence as the daily step's (final review N1): each live
    deal gets a ``manual`` check row, the verification fields and the ``transition`` —
    so the desk's Recheck can move a deal to ``changed`` / ``expired`` exactly as the
    06:00 step would, and clears its own "recheck due" nag. An empty answer only stamps
    ``unverified_since`` (no row, no missed day): during a gated fli window "no fares"
    usually means "blocked", not "gone" (spec: fli-resilience).
    """
    deals = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.candidate_id == candidate.id,
            models.PublishedDeal.status.in_(LIVE_STATUSES),
        )
    ).all()
    if not fares:
        for pd in deals:
            if pd.unverified_since is None:
                pd.unverified_since = now
        return
    zone = session.get(models.Zone, candidate.zone) if candidate.zone else None
    for pd in deals:
        check = _check_from_fares(
            fares,
            snapshot=candidate.itinerary_snapshot,
            travel_date=candidate.travel_date,
            source="manual",
            now=now,
        )
        tpl = session.get(models.DealTemplate, pd.deal_template_id)
        record_check(
            session,
            pd,
            check,
            gates=gates_for(tpl, zone),
            today=now.date(),
            run_healthy=True,  # a hand recheck is a real answer, never a gated pass
            now=now,
            run_id=None,
        )
        pd.going_fast = pd.current_price >= pd.price * (1 + GOING_FAST_RISE)


def recheck_candidate(
    session: Session, candidate: models.Candidate, adapter: FliAdapter, now: datetime
) -> models.VerificationCheck:
    """Re-verify a candidate (desk button) and record a VerificationCheck row (always).

    Stamps ``verified_at``/``last_seen_at`` on a verified success but never rewrites
    ``candidates.price`` — the discovery price is what the desk and the published deal were
    built on; the observed price lives on the check row (and the request's result_summary).
    The candidate's live published deals get the same treatment as in the daily step
    (``record_check``); empty results stamp ``unverified_since`` instead.
    """
    available, price, currency, booking_url, notes, raw = False, None, None, None, None, None
    responded = False
    fares = []
    cabin = (candidate.search_params or {}).get("cabin", "ECONOMY")
    try:
        fares = adapter.search_flights(
            candidate.origin,
            candidate.destination,
            candidate.travel_date,
            candidate.return_date,
            cabin,
        )
        responded = True
        if fares:
            fare = min(fares, key=lambda f: f.price)
            available, price, currency = True, fare.price, fare.currency
            booking_url, raw = fare.booking_url, fare.raw
        else:
            notes = "no fares returned"
    except ScanError as exc:
        notes = f"recheck failed: {exc}"

    check = models.VerificationCheck(
        candidate_id=candidate.id,
        checked_at=now,
        provider="fli",
        price=price,
        currency=currency,
        booking_url=booking_url,
        available=available,
        notes=notes,
        raw_snapshot=raw,
    )
    session.add(check)
    if available and price is not None:
        candidate.verified_at = now
        candidate.last_seen_at = now
    if responded:
        _update_published_for_candidate(session, candidate, fares, now)
    session.commit()
    return check
