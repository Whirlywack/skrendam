"""PriceDropScorer: flags a fare that fell sharply versus the last recorded price.

Respects the template's itinerary sanity (unlike ErrorFareScorer, which is
deliberately lenient): a big drop on a 3-stop self-transfer is still not a deal.

With scan cohorts in place, tail routes are scanned roughly every 10 days, so
the previous_price comparison is often 7–14 days old.  The scorer labels the
comparison age honestly ("seen N days ago") rather than applying a hard cutoff
or decay — cutting off stale comparisons would blind the scorer on the entire
tail tier, and decay math would add false precision.  Age 0/1/None is treated
as "since the last scan" (normal cadence)."""

from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import itinerary_ok

MIN_DROP_FRAC = 0.20   # must be at least 20% below the previous recorded price
FULL_DROP_FRAC = 0.50  # a 50% drop is full confidence


class PriceDropScorer:
    name = "drop"

    def score(self, ctx: ScoringContext) -> Score | None:
        if not itinerary_ok(ctx.fare, ctx.template):
            return None
        prev = ctx.previous_price
        if not prev or prev <= 0:
            return None
        drop = (prev - ctx.fare.price) / prev
        if drop < MIN_DROP_FRAC:
            return None
        value = round(min(1.0, drop / FULL_DROP_FRAC), 3)
        age = ctx.previous_price_age_days
        if age is not None and age > 1:
            tail = f"seen {age} days ago"
        else:
            tail = "since the last scan"
        reason = (f"EUR{ctx.fare.price:.0f} - down {round(drop * 100)}% from "
                  f"EUR{prev:.0f} {tail}.")
        return Score.from_value("drop", value, reason,
                                {"previous_price": prev, "drop_frac": round(drop, 3),
                                 "previous_price_age_days": age})
