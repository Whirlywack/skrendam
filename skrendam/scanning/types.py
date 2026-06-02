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
class Baseline:
    minimum: float
    median: float
    decile: float        # 10th-percentile price across the window
    sample_size: int


@dataclass(frozen=True)
class MatchResult:
    match_score: float
    reason_text: str
    gate_results: dict
