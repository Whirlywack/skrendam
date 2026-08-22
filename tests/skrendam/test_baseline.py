from datetime import date

from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.types import CalendarPoint


def _pts(prices):
    return [CalendarPoint(date(2026, 7, 1 + i), None, p) for i, p in enumerate(prices)]


def test_baseline_min_median_decile():
    b = compute_baseline(_pts([30, 40, 50, 60, 70, 80, 90, 100, 110, 120]))
    assert b.minimum == 30
    assert b.sample_size == 10
    assert b.median == 75  # average of 70 and 80
    assert b.decile <= b.median  # 10th percentile near the cheap end


def test_empty_returns_none():
    assert compute_baseline([]) is None


def _seasonal_pts():
    # December: expensive holiday fares around 300; January: normal ~150.
    dec = [CalendarPoint(date(2026, 12, 1 + i), None, 280.0 + 4 * i) for i in range(10)]
    jan = [CalendarPoint(date(2027, 1, 1 + i), None, 140.0 + 2 * i) for i in range(10)]
    return dec + jan


def test_month_stats_computed_per_month():
    b = compute_baseline(_seasonal_pts())
    dec = b.by_month["2026-12"]
    jan = b.by_month["2027-01"]
    assert dec.sample_size == jan.sample_size == 10
    assert jan.median < dec.median
    assert jan.mad > 0 and dec.mad > 0


def test_local_discount_compares_january_with_january():
    # The January-bug regression: EUR120 in January is a huge "deal" vs the
    # whole-window median (inflated by December) but modest vs January itself.
    b = compute_baseline(_seasonal_pts())
    window_disc = (b.median - 120.0) / b.median
    local_disc = b.local_discount(120.0, date(2027, 1, 15))
    assert window_disc > 0.4          # the old, flattering number
    assert local_disc < 0.25          # the honest, month-local number


def test_thin_month_falls_back_to_window():
    pts = _seasonal_pts() + [CalendarPoint(date(2027, 2, 1), None, 100.0)]  # 1-pt month
    b = compute_baseline(pts)
    assert b.month_stats(date(2027, 2, 1)) is None
    assert b.local_median(date(2027, 2, 1)) == b.median


def test_robust_z_uses_month_scale():
    b = compute_baseline(_seasonal_pts())
    z = b.robust_z(100.0, date(2027, 1, 15))
    assert z is not None and z < -3.5  # far below January's own spread
    # Same absolute price is judged by December's own (higher) level in December.
    z_dec = b.robust_z(100.0, date(2026, 12, 15))
    assert z_dec is not None and z_dec < z  # further below December's median
    assert b.robust_z(b.median, None) is not None  # window fallback works
