from datetime import date, datetime
from types import SimpleNamespace

from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.rarity import RarityScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _series(prices):
    pts = tuple(HistoryPoint(scanned_at=datetime(2026, 1, i + 1),
                             travel_date=date(2026, 6, 1), price=p) for i, p in enumerate(prices))
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def _ctx(price, series):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(), template=SimpleNamespace(primary_scorer="weighted"),
        history=series, previous_price=None)


def test_rarity_fires_when_cheapest_in_history():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225, 240, 250])  # 10 points
    s = RarityScorer().score(_ctx(150.0, series))  # cheaper than all -> percentile 0.0
    assert s is not None
    assert s.scorer == "rarity"
    assert s.value == 1.0


def test_rarity_quiet_for_common_price():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225, 240, 250])
    assert RarityScorer().score(_ctx(245.0, series)) is None  # above the 10th percentile


def test_rarity_needs_enough_history():
    series = _series([200, 150])  # < MIN_HISTORY
    assert RarityScorer().score(_ctx(150.0, series)) is None
