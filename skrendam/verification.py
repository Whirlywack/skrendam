"""Re-confirm a candidate is still live before publishing (spec §6 verification_checks)."""

from datetime import datetime

from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError


def recheck_candidate(session: Session, candidate: models.Candidate, adapter: FliAdapter,
                      now: datetime) -> models.VerificationCheck:
    available, price, currency, booking_url, notes, raw = False, None, None, None, None, None
    try:
        fares = adapter.search_flights(candidate.origin, candidate.destination,
                                       candidate.travel_date, candidate.return_date, "ECONOMY")
        if fares:
            fare = min(fares, key=lambda f: f.price)
            available, price, currency = True, fare.price, fare.currency
            booking_url, raw = fare.booking_url, fare.raw
        else:
            notes = "no fares returned"
    except ScanError as exc:
        notes = f"recheck failed: {exc}"

    check = models.VerificationCheck(candidate_id=candidate.id, checked_at=now, provider="fli",
                                     price=price, currency=currency, booking_url=booking_url,
                                     available=available, notes=notes, raw_snapshot=raw)
    session.add(check)
    if available:
        candidate.verified_at = now
        candidate.price = price
        candidate.last_seen_at = now
    session.commit()
    return check
