"""Single source of truth for score normalization and quality tiers.

Engine-side meaning of a score. Downstream (web tiers.ts / site quality.ts /
analyze.py) reads the result; it must not re-encode these thresholds.
"""

GREAT = 88
RARE = 94


def to_score_100(value: float) -> int:
    """Normalize a 0..1 scorer value to a clamped 0..100 integer."""
    return max(0, min(100, round(value * 100)))


def quality_tier(score_100: int) -> str | None:
    """Map a 0..100 score to a quality tier label (or None below GREAT)."""
    if score_100 >= RARE:
        return "rare"
    if score_100 >= GREAT:
        return "great"
    return None
