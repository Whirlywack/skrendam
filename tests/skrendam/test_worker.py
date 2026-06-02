from datetime import date, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam import worker


def test_scan_request_defaults(session):
    req = models.ScanRequest(kind="full_scan")
    session.add(req)
    session.commit()
    assert req.id is not None
    assert req.status == "queued"
    assert req.requested_by == "curator"
    assert req.created_at is not None
    assert req.candidate_id is None


def test_scan_request_requires_kind(session):
    session.add(models.ScanRequest())
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


class FakeBackend:
    """Mimics the live fli backend surface used by recheck/run_scan."""
    def __init__(self, fares=None):
        self._fares = fares if fares is not None else [
            {"price": 41.0, "currency": "EUR", "booking_url": "https://x", "stops": 0}
        ]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return list(self._fares)

    def search_dates(self, *a, **k):
        return []


def _adapter(fares=None):
    return FliAdapter(FakeBackend(fares), pace=lambda: None)


def _seed_candidate(session):
    session.add(models.Route(id=1, origin="VNO", destination="LCA", zone="MED"))
    cand = models.Candidate(
        id=1, route_id=1, origin="VNO", destination="LCA", zone="MED",
        trip_type="oneway", travel_date=date(2026, 10, 14), price=59.0,
        currency="EUR", status="new", deal_group_key="VNO|LCA|oneway|2026-10-14|59",
        search_params={"cabin": "ECONOMY"},
    )
    session.add(cand)
    session.commit()
    return cand


def test_recheck_request_runs_and_marks_done(session):
    cand = _seed_candidate(session)
    req = models.ScanRequest(kind="recheck", candidate_id=cand.id)
    session.add(req)
    session.commit()
    n = worker.process_pending_requests(session, _adapter(), today=date(2026, 6, 2), now=datetime(2026, 6, 2, 8, 0))
    assert n == 1
    session.refresh(req)
    assert req.status == "done"
    assert req.started_at == datetime(2026, 6, 2, 8, 0)
    assert req.finished_at is not None
    assert req.result_summary["available"] is True
    assert session.query(models.VerificationCheck).count() == 1


def test_recheck_missing_candidate_marks_error(session):
    req = models.ScanRequest(kind="recheck", candidate_id=999)
    session.add(req)
    session.commit()
    worker.process_pending_requests(session, _adapter(), today=date(2026, 6, 2), now=datetime(2026, 6, 2, 8, 0))
    session.refresh(req)
    assert req.status == "error"
    assert "999" in (req.error or "")


def test_only_queued_are_claimed_and_limit_respected(session):
    _seed_candidate(session)
    for _ in range(3):
        session.add(models.ScanRequest(kind="recheck", candidate_id=1))
    session.add(models.ScanRequest(kind="recheck", candidate_id=1, status="done"))
    session.commit()
    n = worker.process_pending_requests(session, _adapter(), today=date(2026, 6, 2), now=datetime(2026, 6, 2, 8, 0), limit=2)
    assert n == 2
    assert session.query(models.ScanRequest).filter_by(status="queued").count() == 1
