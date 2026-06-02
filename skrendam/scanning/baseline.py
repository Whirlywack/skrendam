"""Window-relative baseline — our 'what is normal for this route' signal (no history needed)."""

import statistics

from skrendam.scanning.types import Baseline, CalendarPoint


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        raise ValueError("empty")
    k = (len(sorted_vals) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)


def compute_baseline(points: list[CalendarPoint]) -> Baseline | None:
    prices = sorted(p.price for p in points)
    if not prices:
        return None
    return Baseline(
        minimum=prices[0],
        median=statistics.median(prices),
        decile=_percentile(prices, 0.10),
        sample_size=len(prices),
    )
