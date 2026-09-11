"""The default scorer: per-template gates + weighted blend. Parity with the
historical matching.match() — same gates, same weights, same thresholds.
"""

from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import (
    STRONG_ANOMALY_DISCOUNT,  # noqa: F401  (re-exported; matching.py imports it from here)
    eff,
    gates_for,
    itinerary_ok,
    price_anomaly_ok,
    under_ceiling,
    under_psych,
)

WEIGHTS = {"price_anomaly": 0.50, "itinerary_quality": 0.20, "bookability": 0.15, "urgency": 0.15}
SEND_THRESHOLD = 0.55


class WeightedScorer:
    name = "weighted"

    def score(self, ctx: ScoringContext) -> Score | None:
        fare, tpl, baseline, zone = ctx.fare, ctx.template, ctx.baseline, ctx.zone
        gates: dict = {}
        # Month-local discount: compare January with January. The window median
        # inflated seasonal-trough fares by up to 2x (Wave-0 T3: 24% of a batch).
        local_median = baseline.local_median(ctx.travel_date)
        discount = baseline.local_discount(fare.price, ctx.travel_date)
        abs_savings = max(0.0, local_median - fare.price)

        # Gate 1: price anomaly (hard) — the same predicate the daily verification
        # step applies to live deals (eligibility.price_anomaly_ok). It folds in the
        # STRONG_ANOMALY_DISCOUNT floor that used to be a separate veto below.
        price_gates = gates_for(tpl, zone)
        under_price = under_ceiling(fare.price, price_gates)
        under_psych_price = under_psych(fare.price, price_gates)
        price_anomaly = price_anomaly_ok(fare.price, local_median, price_gates)
        gates["price_anomaly"] = price_anomaly
        if not price_anomaly:
            return None

        # Gate 2: itinerary sanity (hard)
        ok = itinerary_ok(fare, tpl)
        gates["itinerary_sanity"] = ok
        if not ok:
            return None

        # Gate 3: marketability (soft - informs score)
        min_abs = eff(tpl, zone, "min_abs_savings_eur") or 0
        marketable = (abs_savings >= min_abs) or under_psych_price
        gates["marketability"] = bool(marketable)

        # Monotone in cheapness: the 0.4 under-ceiling floor applies at ANY discount,
        # so a fare just below the median can never score worse than the same fare above it.
        s_anom = min(1.0, discount / 0.5) if discount > 0 else 0.0
        if under_price or under_psych_price:
            s_anom = max(s_anom, 0.4)
        s_itin = 1.0 if fare.stops == 0 else (0.6 if fare.stops == 1 else 0.3)
        s_book = 1.0 if (not fare.self_transfer and not fare.mixed_cabin) else 0.4
        s_urg = 1.0 if marketable else 0.6
        score = (
            WEIGHTS["price_anomaly"] * s_anom
            + WEIGHTS["itinerary_quality"] * s_itin
            + WEIGHTS["bookability"] * s_book
            + WEIGHTS["urgency"] * s_urg
        )

        if score < SEND_THRESHOLD:
            return None

        pct = round(discount * 100)
        month_local = ctx.travel_date is not None and baseline.month_stats(ctx.travel_date)
        basis = (
            f"its {ctx.travel_date:%B} median" if month_local
            else f"the {baseline.sample_size}-day median"
        )
        reason = (
            f"EUR{fare.price:.0f} - {pct}% below {basis} "
            f"(EUR{local_median:.0f}); {'nonstop' if fare.stops == 0 else f'{fare.stops} stop(s)'}."
        )
        value = round(score, 3)
        return Score.from_value("weighted", value, reason, gates)
