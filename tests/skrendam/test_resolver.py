from datetime import date

from skrendam.db import models
from skrendam.scanning.resolver import resolve


def _routes():
    return [
        models.Route(id=1, origin="VNO", destination="BCN", zone="MEDITERRANEAN", enabled=True),
        models.Route(id=2, origin="VNO", destination="OSL", zone="SCANDINAVIA", enabled=True),
        models.Route(id=3, origin="KUN", destination="AGP", zone="MEDITERRANEAN", enabled=False),
    ]


def test_relative_oneway_window_and_zone_filter():
    tpl = models.DealTemplate(
        slug="lastminute", name="x", trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=3, rel_offset_end_days=21, included_zones=["MEDITERRANEAN"],
        included_origins=["VNO", "KUN"])
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    # Only the enabled MEDITERRANEAN route from an included origin (VNO->BCN) qualifies.
    assert len(specs) == 1
    s = specs[0]
    assert (s.origin, s.destination, s.trip_type) == ("VNO", "BCN", "oneway")
    assert s.window_start == date(2026, 6, 5) and s.window_end == date(2026, 6, 23)
    assert s.duration_days is None


def test_seasonal_window_rolls_to_next_occurrence():
    tpl = models.DealTemplate(
        slug="summer", name="x", trip_type="roundtrip", date_window_type="seasonal",
        season_start_mmdd="06-01", season_end_mmdd="08-31", included_zones=["MEDITERRANEAN"],
        trip_len_min_days=4, trip_len_max_days=10)
    # today after the season start -> window uses this year's remaining season
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    s = specs[0]
    assert s.window_start == date(2026, 6, 2)      # clamp to today if season already started
    assert s.window_end == date(2026, 8, 31)
    assert s.duration_days == 4                     # representative = trip_len_min_days


def test_seasonal_before_start_uses_this_year():
    tpl = models.DealTemplate(
        slug="xmas", name="x", trip_type="roundtrip", date_window_type="fixed",
        fixed_start_date=date(2026, 12, 1), fixed_end_date=date(2026, 12, 23),
        included_zones=["MEDITERRANEAN"], trip_len_min_days=2, trip_len_max_days=4)
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    assert specs[0].window_start == date(2026, 12, 1)
    assert specs[0].window_end == date(2026, 12, 23)


def test_seasonal_window_wraps_year_boundary():
    """A Dec-01 -> Feb-28 season must produce window_start=2026-12-01, window_end=2027-02-28."""
    routes = [models.Route(id=10, origin="VNO", destination="BCN", zone="MED", enabled=True)]
    tpl = models.DealTemplate(
        slug="winter", name="x", trip_type="oneway", date_window_type="seasonal",
        season_start_mmdd="12-01", season_end_mmdd="02-28",
        included_zones=["MED"])
    specs = resolve(tpl, routes, today=date(2026, 6, 2))
    assert specs, "Expected at least one SearchSpec for the wrapping season"
    s = specs[0]
    assert s.window_start == date(2026, 12, 1)
    assert s.window_end == date(2027, 2, 28)
