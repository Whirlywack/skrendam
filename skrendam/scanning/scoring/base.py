"""The Scorer seam: the interface and the immutable data it moves."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

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


@dataclass(frozen=True)
class ScoringContext:
    fare: FareItinerary
    baseline: Baseline
    zone: "models.Zone"
    template: "models.DealTemplate"
    history: "PriceHistorySeries | None" = None
    previous_price: float | None = None


class Scorer(Protocol):
    name: str

    def score(self, ctx: ScoringContext) -> Score | None: ...
