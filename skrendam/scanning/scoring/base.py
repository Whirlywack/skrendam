"""The Scorer seam: the interface and the immutable data it moves."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Protocol

from skrendam.scanning.scoring import tiering
from skrendam.scanning.types import Baseline, FareItinerary

if TYPE_CHECKING:
    from skrendam.db import models
    from skrendam.scanning.history import PriceHistorySeries


@dataclass(frozen=True)
class Score:
    scorer: str
    value: float            # 0..1 native confidence
    score_0_100: int        # normalized for display + tiering
    quality_tier: str | None
    reason_text: str
    signals: dict

    @classmethod
    def from_value(cls, scorer: str, value: float, reason_text: str, signals: dict) -> "Score":
        """Build a Score, normalizing `value` (0..1) to score_0_100 + quality_tier
        through the single tiering source of truth — so no scorer can mis-normalize."""
        s100 = tiering.to_score_100(value)
        return cls(scorer=scorer, value=value, score_0_100=s100,
                   quality_tier=tiering.quality_tier(s100), reason_text=reason_text, signals=signals)


@dataclass(frozen=True)
class ScoringContext:
    fare: FareItinerary
    baseline: Baseline
    zone: "models.Zone"
    template: "models.DealTemplate"
    history: "PriceHistorySeries | None" = None
    previous_price: float | None = None
    # (now - scanned_at).days with now always midnight (orchestrator) — age 0/1 reads
    # "since the last scan" in drop.py; >1 states the age.
    previous_price_age_days: int | None = None
    # Travel date of the fare being scored — lets scorers use month-local
    # baseline stats (compare January with January). None = window stats.
    travel_date: "date | None" = None


class Scorer(Protocol):
    name: str

    def score(self, ctx: ScoringContext) -> Score | None: ...
