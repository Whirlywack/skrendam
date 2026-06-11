"""Re-confirm a candidate is still live before publishing (spec §6 verification_checks).

Empty search results never expire deals: during a gated fli window an empty result means the
pipe is blocked, not that the fare is gone (fli-resilience spec). Deals leave the site only via
the orchestrator date-sweep or a curator action.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError

GOING_FAST_RISE = (
    0.05  # a recheck price >= published price * (1 + this) is an observed "going fast"
)


def _update_published_for_candidate(
    session: Session, candidate_id: int, available: bool, price: float | None, now: datetime
) -> None:
    """Propagate a recheck result to the candidate's LIVE published deals.

    An empty result NEVER expires a deal: during a gated fli window "no fares"
    usually means "blocked", not "gone" (spec: fli-resilience). Deals leave the
    site via the date sweep (orchestrator) or the curator — never via emptiness.
    """
    deals = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.candidate_id == candidate_id, models.PublishedDeal.status == "live"
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
    """Re-verify a candidate and record a VerificationCheck row (always).

    Mutates the candidate only on a verified success (available + price); never
    writes PublishedDeal.status — deals leave the site only via the orchestrator
    date-sweep or a curator action. Empty results stamp unverified_since instead.
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
        candidate.price = price
        candidate.last_seen_at = now
    if responded:
        _update_published_for_candidate(session, candidate.id, available, price, now)
    session.commit()
    return check
