"""Per-template gates + weighted match score. Pure: template + zone + fare in, MatchResult out.

# v1 itinerary-gate limitation: only max_stops, max_total_duration_minutes,
# self_transfer and mixed_cabin are enforced. allow_airport_change /
# allow_overnight_layover are accepted but currently always-False (live_backend
# does not yet populate them), and family_friendly_times_only / latest_arrival_hour
# / earliest_departure_hour / min_layover_minutes / max_layover_minutes are not yet
# evaluated (FareItinerary does not yet capture per-leg times/layovers). These are
# tracked follow-ups; the gate over-includes rather than misbehaves.
"""

from skrendam.db import models
from skrendam.scanning.types import Baseline, FareItinerary, MatchResult

WEIGHTS = {"price_anomaly": 0.50, "itinerary_quality": 0.20,
           "bookability": 0.15, "urgency": 0.15}
SEND_THRESHOLD = 0.55
STRONG_ANOMALY_DISCOUNT = 0.20  # price-anomaly must be strong on its own


def _eff(tpl, zone, name):
    """Template value if set, else the zone default."""
    v = getattr(tpl, name, None)
    return v if v is not None else getattr(zone, name, None)


def match(fare: FareItinerary, tpl: "models.DealTemplate", baseline: Baseline,
          zone: "models.Zone") -> MatchResult | None:
    gates: dict = {}
    discount = 0.0 if baseline.median <= 0 else (baseline.median - fare.price) / baseline.median
    abs_savings = max(0.0, baseline.median - fare.price)

    # Gate 1: price anomaly (hard)
    max_price = tpl.max_price_eur if tpl.max_price_eur is not None else zone.threshold_price_eur
    min_disc = _eff(tpl, zone, "min_discount_pct")
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
    itinerary_ok = True
    if tpl.max_stops is not None and fare.stops > tpl.max_stops:
        itinerary_ok = False
    if tpl.max_total_duration_minutes and fare.duration_minutes > tpl.max_total_duration_minutes:
        itinerary_ok = False
    if not tpl.allow_self_transfer and fare.self_transfer:
        itinerary_ok = False
    if not tpl.allow_mixed_cabin and fare.mixed_cabin:
        itinerary_ok = False
    if not tpl.allow_airport_change and fare.airport_change:
        itinerary_ok = False
    if not tpl.allow_overnight_layover and fare.overnight_layover:
        itinerary_ok = False
    gates["itinerary_sanity"] = itinerary_ok
    if not itinerary_ok:
        return None

    # Gate 3: marketability (soft - informs score)
    min_abs = _eff(tpl, zone, "min_abs_savings_eur") or 0
    marketable = (abs_savings >= min_abs) or under_psych
    gates["marketability"] = bool(marketable)

    # Component sub-scores (0..1)
    s_anom = min(1.0, discount / 0.5) if discount > 0 else (0.4 if under_price or under_psych else 0.0)
    s_itin = 1.0 if fare.stops == 0 else (0.6 if fare.stops == 1 else 0.3)
    s_book = 1.0 if (not fare.self_transfer and not fare.mixed_cabin) else 0.4
    s_urg = 1.0 if marketable else 0.6
    score = (WEIGHTS["price_anomaly"] * s_anom + WEIGHTS["itinerary_quality"] * s_itin
             + WEIGHTS["bookability"] * s_book + WEIGHTS["urgency"] * s_urg)

    # A fare is a "strong" anomaly if it meets the template's own discount bar
    # (when one is set, even below 20%), or is under an absolute/psychological
    # ceiling. Fall back to STRONG_ANOMALY_DISCOUNT only when no min discount is set.
    discount_floor = min_disc_frac if min_disc_frac > 0 else STRONG_ANOMALY_DISCOUNT
    strong_anomaly = discount >= discount_floor or under_psych or under_price
    if score < SEND_THRESHOLD or not strong_anomaly:
        return None

    pct = round(discount * 100)
    reason = (f"EUR{fare.price:.0f} - {pct}% below the {baseline.sample_size}-day median "
              f"(EUR{baseline.median:.0f}); {'nonstop' if fare.stops == 0 else f'{fare.stops} stop(s)'}.")
    return MatchResult(match_score=round(score, 3), reason_text=reason, gate_results=gates)
