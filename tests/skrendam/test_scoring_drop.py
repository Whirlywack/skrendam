from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _tpl(**over):
    base = {
        "primary_scorer": "weighted",
        "max_stops": None,
        "max_total_duration_minutes": None,
        "allow_self_transfer": True,
        "allow_mixed_cabin": True,
        "allow_airport_change": True,
        "allow_overnight_layover": True,
    }
    base.update(over)
    return SimpleNamespace(**base)


def _ctx(price, previous_price, *, stops=0, tpl=None, previous_price_age_days=None):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=stops, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(),
        template=tpl or _tpl(),
        history=None,
        previous_price=previous_price,
        previous_price_age_days=previous_price_age_days,
    )


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


def test_drop_respects_itinerary_gate():
    # A big drop on a 2-stop fare under a max_stops=1 template must NOT fire.
    ctx = _ctx(100.0, previous_price=200.0, stops=2, tpl=_tpl(max_stops=1))
    assert PriceDropScorer().score(ctx) is None


def test_drop_reason_states_age_when_stale():
    s = PriceDropScorer().score(_ctx(100.0, previous_price=200.0, previous_price_age_days=12))
    assert s is not None
    assert "12 days ago" in s.reason_text
    assert s.signals["previous_price_age_days"] == 12


def test_drop_reason_fresh_comparison_keeps_last_scan_copy():
    s = PriceDropScorer().score(_ctx(100.0, previous_price=200.0, previous_price_age_days=1))
    assert s is not None
    assert "since the last scan" in s.reason_text
