"""RarityScorer: scores how rarely a route is ever this cheap, from the full
recorded-price percentile."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext

RARE_PCTILE = 0.10  # price must sit in the cheapest 10% of recorded prices
MIN_HISTORY = 10


class RarityScorer:
    name = "rarity"

    def score(self, ctx: ScoringContext) -> Score | None:
        hist = ctx.history
        if hist is None or len(hist.points) < MIN_HISTORY:
            return None
        pct = hist.percentile(ctx.fare.price)  # fraction at or below
        if pct > RARE_PCTILE:
            return None
        value = round(min(1.0, 1.0 - pct), 3)  # cheaper => rarer => higher
        s100 = tiering.to_score_100(value)
        reason = (f"EUR{ctx.fare.price:.0f} - in the cheapest {round(pct * 100)}% of "
                  f"{len(hist.points)} recorded prices for this route.")
        return Score(scorer="rarity", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason,
                     signals={"percentile": round(pct, 3), "history_points": len(hist.points)})
