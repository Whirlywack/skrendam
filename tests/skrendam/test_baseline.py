from datetime import date

from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.types import CalendarPoint


def _pts(prices):
    return [CalendarPoint(date(2026, 7, 1 + i), None, p) for i, p in enumerate(prices)]


def test_baseline_min_median_decile():
    b = compute_baseline(_pts([30, 40, 50, 60, 70, 80, 90, 100, 110, 120]))
    assert b.minimum == 30
    assert b.sample_size == 10
    assert b.median == 75            # average of 70 and 80
    assert b.decile <= b.median      # 10th percentile near the cheap end


def test_empty_returns_none():
    assert compute_baseline([]) is None
