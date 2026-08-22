"""Scorer registry. enabled_scorers() returns all registered scorers in a
deterministic order; the orchestrator runs every one per in-scope template."""

from skrendam.scanning.scoring.base import Score, Scorer
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.scoring.error_fare import ErrorFareScorer
from skrendam.scanning.scoring.outlier import OutlierScorer
from skrendam.scanning.scoring.rarity import RarityScorer
from skrendam.scanning.scoring.weighted import WeightedScorer

_REGISTRY: dict[str, Scorer] = {}
_ENABLED: list[Scorer] | None = None  # memoized sorted view, rebuilt on register()


def register(scorer: Scorer) -> None:
    global _ENABLED
    _REGISTRY[scorer.name] = scorer
    _ENABLED = None


def get(name: str) -> Scorer | None:
    return _REGISTRY.get(name)


def enabled_scorers() -> list[Scorer]:
    """All registered scorers in a stable order. Built once and reused — the set
    is fixed at import time, so the orchestrator's per-fare loop pays no re-sort."""
    global _ENABLED
    if _ENABLED is None:
        _ENABLED = [_REGISTRY[k] for k in sorted(_REGISTRY)]
    return _ENABLED


def pick_headline(scores: list[Score], primary_scorer: str | None) -> Score:
    """The headline score for a match: the template's primary scorer if it fired,
    else the highest-scoring strategy that did. `scores` must be non-empty."""
    name = primary_scorer or "weighted"
    return next((s for s in scores if s.scorer == name), None) or max(
        scores, key=lambda s: s.score_0_100
    )


register(WeightedScorer())
register(PriceDropScorer())
register(ErrorFareScorer())
register(RarityScorer())
register(OutlierScorer())
