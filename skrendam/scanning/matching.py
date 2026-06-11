"""Back-compat shim. The scoring logic now lives in skrendam.scanning.scoring;
this delegates to WeightedScorer so legacy callers and tests keep working.

New code should use skrendam.scanning.scoring (registry + ScoringContext)."""

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.weighted import (  # noqa: F401  (re-exported for back-compat)
    SEND_THRESHOLD,
    STRONG_ANOMALY_DISCOUNT,
    WEIGHTS,
    WeightedScorer,
)
from skrendam.scanning.types import Baseline, FareItinerary, MatchResult

_WEIGHTED = WeightedScorer()


def match(fare: FareItinerary, tpl, baseline: Baseline, zone) -> MatchResult | None:
    """Delegate to WeightedScorer and adapt to the legacy MatchResult shape."""
    ctx = ScoringContext(fare=fare, baseline=baseline, zone=zone, template=tpl)
    s = _WEIGHTED.score(ctx)
    if s is None:
        return None
    return MatchResult(match_score=s.value, reason_text=s.reason_text, gate_results=s.signals)
