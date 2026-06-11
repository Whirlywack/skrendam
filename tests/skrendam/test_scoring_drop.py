from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _ctx(price, previous_price):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(), template=SimpleNamespace(primary_scorer="weighted"),
        history=None, previous_price=previous_price)


def test_drop_fires_on_big_fall():
    s = PriceDropScorer().score(_ctx(100.0, previous_price=200.0))  # 50% drop
    assert s is not None
    assert s.scorer == "drop"
    assert s.value == 1.0
    assert s.signals["drop_frac"] == 0.5


def test_drop_ignores_small_fall():
    assert PriceDropScorer().score(_ctx(190.0, previous_price=200.0)) is None  # 5%


def test_drop_none_without_previous():
    assert PriceDropScorer().score(_ctx(100.0, previous_price=None)) is None
