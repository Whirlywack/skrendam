"""Plain data passed between pure logic modules (no I/O, no ORM)."""

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class SearchSpec:
    origin: str
    destination: str
    trip_type: str            # oneway|roundtrip
    window_start: date
    window_end: date
    duration_days: int | None  # set for roundtrip, else None
    cabin: str = "ECONOMY"


@dataclass(frozen=True)
class CalendarPoint:
    travel_date: date
    return_date: date | None
    price: float


@dataclass
class FareItinerary:
    price: float
    currency: str
    stops: int
    duration_minutes: int
    legs: list[dict]
    self_transfer: bool = False
    mixed_cabin: bool = False
    airport_change: bool = False
    overnight_layover: bool = False
    max_layover_minutes: int | None = None
    booking_url: str | None = None
    raw: dict = field(default_factory=dict)


@dataclass(frozen=True)
class MonthStats:
    median: float
    mad: float           # median absolute deviation of the month's prices
    decile: float        # 10th-percentile price within the month
    sample_size: int


# Below this many same-month calendar points, month-local stats are noise —
# fall back to whole-window stats (Wave-0 test T3 skipped <5 the same way).
MIN_MONTH_SAMPLE = 5


@dataclass(frozen=True)
class Baseline:
    """Window stats plus month-local stats.

    Whole-window medians conflate "cheap month" with "cheap fare" (a January
    date measured against a Nov–Mar median that includes Christmas peaks looks
    like a −60% deal; Wave-0 T3 measured 24% of a real batch inflated this
    way). The month-local accessors compare January with January; window stats
    remain the fallback for thin months and the back-compat surface.
    """

    minimum: float
    median: float
    decile: float        # 10th-percentile price across the window
    sample_size: int
    mad: float = 0.0     # MAD across the window
    by_month: dict[str, MonthStats] = field(default_factory=dict)  # "YYYY-MM" -> stats

    def month_stats(self, travel_date: date) -> MonthStats | None:
        m = self.by_month.get(f"{travel_date:%Y-%m}")
        return m if m is not None and m.sample_size >= MIN_MONTH_SAMPLE else None

    def local_median(self, travel_date: date | None) -> float:
        if travel_date is not None and (m := self.month_stats(travel_date)):
            return m.median
        return self.median

    def local_discount(self, price: float, travel_date: date | None) -> float:
        med = self.local_median(travel_date)
        return 0.0 if med <= 0 else (med - price) / med

    def robust_z(self, price: float, travel_date: date | None) -> float | None:
        """Modified z-score vs the travel month (fallback: window). None when
        the scale is degenerate (MAD 0 — e.g. a flat single-bucket month)."""
        if travel_date is not None and (m := self.month_stats(travel_date)):
            med, mad = m.median, m.mad
        else:
            med, mad = self.median, self.mad
        if mad <= 0:
            return None
        return 0.6745 * (price - med) / mad


@dataclass(frozen=True)
class MatchResult:
    match_score: float
    reason_text: str
    gate_results: dict
