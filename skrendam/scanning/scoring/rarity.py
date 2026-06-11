"""RarityScorer: scores how rarely a route is ever this cheap, from the full
recorded-price percentile.

Respects the template's itinerary sanity (unlike ErrorFareScorer, which is
deliberately lenient): a record-low price on a miserable itinerary is not a deal."""

from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import itinerary_ok

RARE_PCTILE = 0.10  # price must sit in the cheapest 10% of recorded prices
MIN_HISTORY = 10


class RarityScorer:
    name = "rarity"

    def score(self, ctx: ScoringContext) -> Score | None:
        if not itinerary_ok(ctx.fare, ctx.template):
            return None
        hist = ctx.history
        if hist is None or len(hist.points) < MIN_HISTORY:
            return None
        pct = hist.percentile(ctx.fare.price)  # fraction at or below
        if pct > RARE_PCTILE:
            return None
        value = round(min(1.0, 1.0 - pct), 3)  # cheaper => rarer => higher
        reason = (f"EUR{ctx.fare.price:.0f} - in the cheapest {round(pct * 100)}% of "
                  f"{len(hist.points)} recorded prices for this route.")
        return Score.from_value("rarity", value, reason,
                                {"percentile": round(pct, 3), "history_points": len(hist.points)})
