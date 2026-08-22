"""Window-relative baseline — our 'what is normal for this route' signal (no history needed)."""

import statistics
from collections import defaultdict

from skrendam.scanning.types import Baseline, CalendarPoint, MonthStats


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        raise ValueError("empty")
    k = (len(sorted_vals) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)


def _mad(vals: list[float], med: float) -> float:
    return statistics.median(abs(v - med) for v in vals)


def compute_baseline(points: list[CalendarPoint]) -> Baseline | None:
    prices = sorted(p.price for p in points)
    if not prices:
        return None
    med = statistics.median(prices)

    monthly: dict[str, list[float]] = defaultdict(list)
    for p in points:
        monthly[f"{p.travel_date:%Y-%m}"].append(p.price)
    by_month = {}
    for month, vals in monthly.items():
        vals.sort()
        m_med = statistics.median(vals)
        by_month[month] = MonthStats(
            median=m_med, mad=_mad(vals, m_med), decile=_percentile(vals, 0.10),
            sample_size=len(vals),
        )

    return Baseline(
        minimum=prices[0],
        median=med,
        decile=_percentile(prices, 0.10),
        sample_size=len(prices),
        mad=_mad(prices, med),
        by_month=by_month,
    )
