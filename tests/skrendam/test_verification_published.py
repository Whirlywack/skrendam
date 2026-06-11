from datetime import date, datetime

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.verification import recheck_candidate


def _seed(session, price=96.0):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(
        id=1,
        route_id=1,
        origin="VNO",
        destination="BCN",
        zone="MED",
        trip_type="oneway",
        travel_date=date(2026, 9, 12),
        price=price,
        deal_group_key="k",
        first_seen_at=datetime(2026, 6, 2),
        last_seen_at=datetime(2026, 6, 2),
    )
    session.add(cand)
    session.add(
        models.PublishedDeal(
            id=1,
            candidate_id=1,
            deal_template_id=1,
            headline="h",
            origin="VNO",
            destination="BCN",
            trip_type="oneway",
            price=price,
            status="live",
            tier="free",
            published_at=datetime(2026, 6, 2),
        )
    )
    session.commit()
    return cand


class _Backend:
    def __init__(self, fares):
        self._fares = fares

    def search_flights(self, *a, **k):
        return self._fares


def _fare(price):
    return [
        {
            "price": price,
            "currency": "EUR",
            "stops": 0,
            "duration": 200,
            "legs": [{"airline": {"code": "BT"}}],
            "booking_url": "https://x",
        }
    ]


def test_recheck_marks_going_fast_when_price_rises(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(120.0)), pace=lambda: None)  # +25%
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is True
    assert pd.status == "live"
    assert pd.last_seen_at == datetime(2026, 6, 3)


def test_recheck_no_flag_when_stable(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(98.0)), pace=lambda: None)  # +2%, under threshold
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is False and pd.status == "live"


def test_recheck_empty_keeps_deal_live_and_marks_unverified(session):
    """Empty fli results must NOT expire live deals.

    The pipe may be gated (the silent-empty mode), not the fare gone.
    """
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)  # no fares
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)
    assert pd.last_seen_at is None  # an unverifiable check is not a sighting


def test_second_empty_recheck_keeps_first_unverified_timestamp(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 4))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)


def test_successful_recheck_clears_unverified(session):
    cand = _seed(session, price=96.0)
    recheck_candidate(
        session, cand, FliAdapter(_Backend([]), pace=lambda: None), now=datetime(2026, 6, 3)
    )
    recheck_candidate(
        session,
        cand,
        FliAdapter(_Backend(_fare(98.0)), pace=lambda: None),
        now=datetime(2026, 6, 4),
    )
    pd = session.get(models.PublishedDeal, 1)
    assert pd.unverified_since is None
    assert pd.status == "live"
    assert pd.last_seen_at == datetime(2026, 6, 4)


def test_recheck_scan_error_leaves_published_deal_live(session):
    """A transient ScanError must NOT expire live published deals."""
    cand = _seed(session, price=96.0)

    class _ErrorBackend:
        def search_flights(self, *a, **k):
            raise ScanError("connection timeout")

    adapter = FliAdapter(_ErrorBackend(), pace=lambda: None)
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live", "ScanError must not expire a live published deal"
    assert pd.going_fast is False  # unchanged from seed default
    assert pd.unverified_since is None  # errors are no evidence; only emptiness stamps the marker


def test_recheck_resets_going_fast_when_price_falls(session):
    """going_fast must clear when a recheck price no longer warrants it."""
    cand = _seed(session, price=96.0)
    # Manually set the published deal as going_fast=True (as if a previous recheck flagged it)
    pd = session.get(models.PublishedDeal, 1)
    pd.going_fast = True
    session.commit()

    # Recheck returns a price at or below the published price — no 5% rise
    adapter = FliAdapter(_Backend(_fare(96.0)), pace=lambda: None)  # same price, 0% rise
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    session.expire(pd)
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is False, (
        "going_fast must reset when recheck price no longer rises above threshold"
    )
    assert pd.status == "live"
