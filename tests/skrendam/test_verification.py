from datetime import date, datetime

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.verification import recheck_candidate


class FakeBackend:
    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [
            {
                "price": 32.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}}],
                "booking_url": "https://x",
            }
        ]


def test_recheck_appends_check_and_sets_verified_at(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(
        id=1,
        route_id=1,
        origin="VNO",
        destination="BCN",
        zone="MED",
        trip_type="oneway",
        travel_date=date(2026, 7, 29),
        price=30,
        deal_group_key="k",
        first_seen_at=datetime(2026, 6, 2),
        last_seen_at=datetime(2026, 6, 2),
    )
    session.add(cand)
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)

    check = recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    assert check.available is True and check.price == 32.0
    assert cand.verified_at == datetime(2026, 6, 3)
    assert session.query(models.VerificationCheck).count() == 1
