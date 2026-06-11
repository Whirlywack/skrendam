"""ErrorFareScorer: flags a fare implausibly far below the cheapest price ever
recorded for the route. Lenient on itinerary on purpose — an error fare is worth
surfacing even if ugly."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext

MIN_BELOW_MIN_FRAC = 0.30  # at least 30% below the recorded floor
MIN_HISTORY = 8            # need enough history to trust the floor


class ErrorFareScorer:
    name = "error_fare"

    def score(self, ctx: ScoringContext) -> Score | None:
        hist = ctx.history
        if hist is None or len(hist.points) < MIN_HISTORY:
            return None
        floor = hist.min_seen()
        if not floor or floor <= 0 or ctx.fare.price >= floor:
            return None
        below = (floor - ctx.fare.price) / floor
        if below < MIN_BELOW_MIN_FRAC:
            return None
        value = round(min(1.0, 0.6 + below), 3)  # error fares rank high
        s100 = tiering.to_score_100(value)
        reason = (f"EUR{ctx.fare.price:.0f} - {round(below * 100)}% below the "
                  f"{len(hist.points)}-point floor of EUR{floor:.0f}. Possible error fare.")
        return Score(scorer="error_fare", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason,
                     signals={"floor": floor, "below_floor_frac": round(below, 3),
                              "history_points": len(hist.points)})
