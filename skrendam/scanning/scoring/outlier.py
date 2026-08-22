"""Volatility-aware outlier scorer: modified z-score vs the travel month's MAD.

Why this exists (Wave-0 T2, 2026-08-22): per-route dispersion spans 14x
(MAD/median 3.1% on RIX-PRG vs 43.8% on VNO-STN), so a fixed "% below median"
rule is ordinary noise on volatile routes and blind on calm ones. A MAD-based
modified z-score prices each fare in units of its own route-month's noise.

Also carries the error-fare magnitude tier: z beyond -5 or >=60% below the
month median marks "possible error fare - verify fast" (Wave-1 spec; magnitudes
per the deal-detection research synthesis).
"""

from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import itinerary_ok

Z_FLAG = -3.5        # robust-outlier gate (modified z)
Z_ERROR = -5.0       # error-fare magnitude
DISC_ERROR = 0.60    # or >=60% below the month median


class OutlierScorer:
    name = "outlier"

    def score(self, ctx: ScoringContext) -> Score | None:
        fare, baseline = ctx.fare, ctx.baseline
        z = baseline.robust_z(fare.price, ctx.travel_date)
        if z is None or z > Z_FLAG:
            return None
        if not itinerary_ok(fare, ctx.template):
            return None

        local_median = baseline.local_median(ctx.travel_date)
        discount = baseline.local_discount(fare.price, ctx.travel_date)
        error_fare = z <= Z_ERROR or discount >= DISC_ERROR

        # z=-3.5 -> ~0.87, deepens with |z|, capped; error fares pin to the top.
        value = 0.98 if error_fare else min(0.96, 0.75 + 0.035 * min(-z, 6.0))
        month = f"{ctx.travel_date:%B}" if ctx.travel_date is not None else "the window"
        if error_fare:
            reason = (
                f"EUR{fare.price:.0f} is extreme for {month} (z={z:.1f}, median "
                f"EUR{local_median:.0f}) - possible error fare, verify fast."
            )
        else:
            reason = (
                f"EUR{fare.price:.0f} is a true outlier for {month} (z={z:.1f} vs the "
                f"month's own spread; median EUR{local_median:.0f})."
            )
        signals = {
            "robust_z": round(z, 2),
            "local_median": round(local_median, 2),
            "possible_error_fare": error_fare,
        }
        return Score.from_value("outlier", round(value, 3), reason, signals)
