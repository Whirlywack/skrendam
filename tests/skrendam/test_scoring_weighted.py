from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.weighted import WeightedScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _tpl(**over):
    base = dict(trip_type="oneway", max_price_eur=None, min_discount_pct=None,
                min_abs_savings_eur=None, psychological_price_threshold_eur=None,
                allow_smaller_discount_if_under_price=False, max_stops=None,
                max_total_duration_minutes=None, allow_self_transfer=True,
                allow_mixed_cabin=True, allow_airport_change=True,
                allow_overnight_layover=True)
    base.update(over)
    return SimpleNamespace(**base)


def _zone(**over):
    base = dict(threshold_price_eur=None, min_discount_pct=None, min_abs_savings_eur=None)
    base.update(over)
    return SimpleNamespace(**base)


def _fare(price, stops=0, **over):
    return FareItinerary(price=price, currency="EUR", stops=stops,
                         duration_minutes=over.pop("duration_minutes", 120),
                         legs=[], **over)


def _ctx(fare, tpl, baseline, zone):
    return ScoringContext(fare=fare, baseline=baseline, zone=zone, template=tpl)


def test_strong_discount_scores_and_fires():
    base = Baseline(minimum=100.0, median=200.0, decile=110.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(100.0), _tpl(min_discount_pct=20), base, _zone()))
    assert s is not None
    assert s.scorer == "weighted"
    assert 0.0 < s.value <= 1.0
    assert s.score_0_100 == round(s.value * 100)
    assert s.signals["price_anomaly"] is True


def test_weak_discount_returns_none():
    base = Baseline(minimum=180.0, median=200.0, decile=190.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(196.0), _tpl(min_discount_pct=20), base, _zone()))
    assert s is None


def test_itinerary_gate_rejects_too_many_stops():
    base = Baseline(minimum=100.0, median=200.0, decile=110.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(100.0, stops=2), _tpl(min_discount_pct=20, max_stops=1), base, _zone()))
    assert s is None
