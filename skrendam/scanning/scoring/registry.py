"""Scorer registry. enabled_scorers() returns all registered scorers in a
deterministic order; the orchestrator runs every one per in-scope template."""

from skrendam.scanning.scoring.base import Scorer
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.scoring.error_fare import ErrorFareScorer
from skrendam.scanning.scoring.rarity import RarityScorer
from skrendam.scanning.scoring.weighted import WeightedScorer

_REGISTRY: dict[str, Scorer] = {}


def register(scorer: Scorer) -> None:
    _REGISTRY[scorer.name] = scorer


def get(name: str) -> Scorer | None:
    return _REGISTRY.get(name)


def enabled_scorers() -> list[Scorer]:
    return [_REGISTRY[k] for k in sorted(_REGISTRY)]


register(WeightedScorer())
register(PriceDropScorer())
register(ErrorFareScorer())
register(RarityScorer())
