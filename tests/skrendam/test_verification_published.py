from datetime import date, datetime
from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.verification import recheck_candidate


def _seed(session, price=96.0):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(id=1, route_id=1, origin="VNO", destination="BCN", zone="MED",
                            trip_type="oneway", travel_date=date(2026, 9, 12), price=price,
                            deal_group_key="k", first_seen_at=datetime(2026, 6, 2),
                            last_seen_at=datetime(2026, 6, 2))
    session.add(cand)
    session.add(models.PublishedDeal(id=1, candidate_id=1, deal_template_id=1, headline="h",
                                     origin="VNO", destination="BCN", trip_type="oneway",
                                     price=price, status="live", tier="free",
                                     published_at=datetime(2026, 6, 2)))
    session.commit()
    return cand


class _Backend:
    def __init__(self, fares): self._fares = fares
    def search_flights(self, *a, **k): return self._fares


def _fare(price):
    return [{"price": price, "currency": "EUR", "stops": 0, "duration": 200,
             "legs": [{"airline": {"code": "BT"}}], "booking_url": "https://x"}]


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


def test_recheck_expires_when_gone(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)  # no fares
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "expired"
