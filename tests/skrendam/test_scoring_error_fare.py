from datetime import date, datetime
from types import SimpleNamespace

from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.error_fare import ErrorFareScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _series(prices):
    pts = tuple(
        HistoryPoint(scanned_at=datetime(2026, 1, i + 1), travel_date=date(2026, 6, 1), price=p)
        for i, p in enumerate(prices)
    )
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def _ctx(price, series):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(),
        template=SimpleNamespace(primary_scorer="weighted"),
        history=series,
        previous_price=None,
    )


def test_error_fare_fires_far_below_floor():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225])  # floor 200, 8 points
    s = ErrorFareScorer().score(_ctx(120.0, series))  # 40% below floor
    assert s is not None
    assert s.scorer == "error_fare"
    assert s.signals["floor"] == 200


def test_error_fare_quiet_near_floor():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225])
    assert ErrorFareScorer().score(_ctx(190.0, series)) is None  # only 5% below floor


def test_error_fare_needs_enough_history():
    series = _series([200, 210, 120])  # < MIN_HISTORY
    assert ErrorFareScorer().score(_ctx(120.0, series)) is None
