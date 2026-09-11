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

__all__ = ["DealCheck", "Decision", "Gates", "gates_for", "price_anomaly_ok"]

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
    if not fares:
        return DealCheck(False, None, None, None, "flights", now)
    wanted = _flight_numbers((snapshot or {}).get("legs"))
    exact = None
    if wanted and all(wanted):
        exact = next((f for f in fares if _flight_numbers(f.legs) == wanted), None)
    cheapest = min(fares, key=lambda f: f.price)
    return DealCheck(
        available=True,
        price=exact.price if exact is not None else None,
        window_min_price=cheapest.price,
        window_min_date=deal.travel_date,
        source="flights",
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
    if price_anomaly_ok(check.window_min_price, deal.baseline_price, gates):
        return Decision("changed", 0, None, "itinerary_gone")
    return Decision("expired", 0, expired_at, "gate_failed")


def _update_published_for_candidate(
    session: Session, candidate_id: int, available: bool, price: float | None, now: datetime
) -> None:
    """Propagate a manual recheck result to the candidate's visible published deals.

    An empty result NEVER expires a deal: during a gated fli window "no fares"
    usually means "blocked", not "gone" (spec: fli-resilience). Deals leave the
    site via the date sweep (orchestrator), the daily verification step, or the
    curator — never via emptiness.
    """
    deals = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.candidate_id == candidate_id,
            models.PublishedDeal.status.in_(LIVE_STATUSES),
        )
    )
    for pd in deals:
        if not available:
            if pd.unverified_since is None:
                pd.unverified_since = now
            continue
        pd.unverified_since = None
        pd.last_seen_at = now
        if price is not None:
            pd.going_fast = price >= pd.price * (1 + GOING_FAST_RISE)


def recheck_candidate(
    session: Session, candidate: models.Candidate, adapter: FliAdapter, now: datetime
) -> models.VerificationCheck:
    """Re-verify a candidate (desk button) and record a VerificationCheck row (always).

    Stamps ``verified_at``/``last_seen_at`` on a verified success but never rewrites
    ``candidates.price`` — the discovery price is what the desk and the published deal were
    built on; the observed price lives on the check row (and the request's result_summary).
    Never writes PublishedDeal.status. Empty results stamp unverified_since instead.
    """
    available, price, currency, booking_url, notes, raw = False, None, None, None, None, None
    responded = False
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
        _update_published_for_candidate(session, candidate.id, available, price, now)
    session.commit()
    return check
