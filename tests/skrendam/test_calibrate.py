from datetime import date

from skrendam.calibrate import calibrate_thresholds
from skrendam.db import models


class FakeBackend:
    def search_calendar(self, spec):
        return [(date(2026, 7, 1 + i), None, 40 + i * 5) for i in range(10)]
    def search_flights(self, *a, **k):
        return []


def test_calibration_sets_zone_thresholds_from_observed_fares(session):
    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True))
    session.commit()
    calibrate_thresholds(session, backend=FakeBackend(), today=date(2026, 6, 2))
    z = session.query(models.Zone).one()
    assert z.threshold_price_eur is not None and z.threshold_price_eur > 0
