from datetime import date
from types import SimpleNamespace

from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.outlier import OutlierScorer
from skrendam.scanning.types import CalendarPoint, FareItinerary


def _tpl(**over):
    base = {
        "trip_type": "roundtrip",
        "max_price_eur": None,
        "min_discount_pct": None,
        "min_abs_savings_eur": None,
        "psychological_price_threshold_eur": None,
        "allow_smaller_discount_if_under_price": False,
        "max_stops": None,
        "max_total_duration_minutes": None,
        "allow_self_transfer": True,
        "allow_mixed_cabin": True,
        "allow_airport_change": True,
        "allow_overnight_layover": True,
    }
    base.update(over)
    return SimpleNamespace(**base)


def _fare(price, stops=0):
    return FareItinerary(price=price, currency="EUR", stops=stops, duration_minutes=180, legs=[])


def _baseline():
    # January prices ~150 with modest spread (MAD ~5).
    pts = [CalendarPoint(date(2027, 1, 1 + i), None, 145.0 + i) for i in range(20)]
    return compute_baseline(pts)


def _ctx(price, tpl=None, travel_date=date(2027, 1, 10), stops=0):
    return ScoringContext(
        fare=_fare(price, stops),
        baseline=_baseline(),
        zone=SimpleNamespace(),
        template=tpl or _tpl(),
        travel_date=travel_date,
    )


def test_ordinary_price_is_silent():
    assert OutlierScorer().score(_ctx(148.0)) is None


def test_true_outlier_fires_with_month_context():
    s = OutlierScorer().score(_ctx(126.0))  # z ≈ −3.8: outlier, not error-extreme
    assert s is not None
    assert s.signals["possible_error_fare"] is False
    assert "January" in s.reason_text
    assert s.quality_tier in ("great", "rare")


def test_extreme_fare_marks_possible_error():
    s = OutlierScorer().score(_ctx(40.0))
    assert s is not None
    assert s.signals["possible_error_fare"] is True
    assert "verify fast" in s.reason_text
    assert s.score_0_100 >= 94  # rare tier — top of the queue


def test_itinerary_gate_still_applies():
    assert OutlierScorer().score(_ctx(40.0, tpl=_tpl(max_stops=0), stops=2)) is None


def test_flat_month_mad_zero_is_silent():
    pts = [CalendarPoint(date(2027, 3, 1 + i), None, 200.0) for i in range(10)]
    b = compute_baseline(pts)
    ctx = ScoringContext(
        fare=_fare(50.0),
        baseline=b,
        zone=SimpleNamespace(),
        template=_tpl(),
        travel_date=date(2027, 3, 5),
    )
    assert OutlierScorer().score(ctx) is None  # degenerate scale — no z
