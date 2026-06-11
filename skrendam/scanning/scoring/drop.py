"""PriceDropScorer: flags a fare that fell sharply versus the last recorded price."""

from skrendam.scanning.scoring.base import Score, ScoringContext

MIN_DROP_FRAC = 0.20   # must be at least 20% below the previous recorded price
FULL_DROP_FRAC = 0.50  # a 50% drop is full confidence


class PriceDropScorer:
    name = "drop"

    def score(self, ctx: ScoringContext) -> Score | None:
        prev = ctx.previous_price
        if not prev or prev <= 0:
            return None
        drop = (prev - ctx.fare.price) / prev
        if drop < MIN_DROP_FRAC:
            return None
        value = round(min(1.0, drop / FULL_DROP_FRAC), 3)
        reason = (f"EUR{ctx.fare.price:.0f} - down {round(drop * 100)}% from "
                  f"EUR{prev:.0f} since the last scan.")
        return Score.from_value("drop", value, reason,
                                {"previous_price": prev, "drop_frac": round(drop, 3)})
