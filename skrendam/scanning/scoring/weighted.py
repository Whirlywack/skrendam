"""The default scorer: per-template gates + weighted blend. Parity with the
historical matching.match() — same gates, same weights, same thresholds."""

from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import eff, itinerary_ok

WEIGHTS = {"price_anomaly": 0.50, "itinerary_quality": 0.20,
           "bookability": 0.15, "urgency": 0.15}
SEND_THRESHOLD = 0.55
STRONG_ANOMALY_DISCOUNT = 0.20


class WeightedScorer:
    name = "weighted"

    def score(self, ctx: ScoringContext) -> Score | None:
        fare, tpl, baseline, zone = ctx.fare, ctx.template, ctx.baseline, ctx.zone
        gates: dict = {}
        discount = 0.0 if baseline.median <= 0 else (baseline.median - fare.price) / baseline.median
        abs_savings = max(0.0, baseline.median - fare.price)

        # Gate 1: price anomaly (hard). One-way templates may fall back to the
        # zone ceiling; round-trips must set their own max_price_eur.
        if tpl.trip_type == "oneway":
            max_price = tpl.max_price_eur if tpl.max_price_eur is not None else zone.threshold_price_eur
        else:
            max_price = tpl.max_price_eur
        min_disc = eff(tpl, zone, "min_discount_pct")
        min_disc_frac = (min_disc / 100.0) if min_disc else 0.0
        under_price = max_price is not None and fare.price <= max_price
        under_psych = (tpl.psychological_price_threshold_eur is not None
                       and fare.price <= tpl.psychological_price_threshold_eur)
        needed_disc = 0.0 if (tpl.allow_smaller_discount_if_under_price and under_psych) else min_disc_frac
        price_anomaly = (discount >= needed_disc) or under_price or under_psych
        gates["price_anomaly"] = bool(price_anomaly)
        if not price_anomaly:
            return None

        # Gate 2: itinerary sanity (hard)
        ok = itinerary_ok(fare, tpl)
        gates["itinerary_sanity"] = ok
        if not ok:
            return None

        # Gate 3: marketability (soft - informs score)
        min_abs = eff(tpl, zone, "min_abs_savings_eur") or 0
        marketable = (abs_savings >= min_abs) or under_psych
        gates["marketability"] = bool(marketable)

        s_anom = min(1.0, discount / 0.5) if discount > 0 else (0.4 if under_price or under_psych else 0.0)
        s_itin = 1.0 if fare.stops == 0 else (0.6 if fare.stops == 1 else 0.3)
        s_book = 1.0 if (not fare.self_transfer and not fare.mixed_cabin) else 0.4
        s_urg = 1.0 if marketable else 0.6
        score = (WEIGHTS["price_anomaly"] * s_anom + WEIGHTS["itinerary_quality"] * s_itin
                 + WEIGHTS["bookability"] * s_book + WEIGHTS["urgency"] * s_urg)

        discount_floor = min_disc_frac if min_disc_frac > 0 else STRONG_ANOMALY_DISCOUNT
        strong_anomaly = discount >= discount_floor or under_psych or under_price
        if score < SEND_THRESHOLD or not strong_anomaly:
            return None

        pct = round(discount * 100)
        reason = (f"EUR{fare.price:.0f} - {pct}% below the {baseline.sample_size}-day median "
                  f"(EUR{baseline.median:.0f}); {'nonstop' if fare.stops == 0 else f'{fare.stops} stop(s)'}.")
        value = round(score, 3)
        return Score.from_value("weighted", value, reason, gates)
