"""Shared pure gate helpers. Scorers may apply these; none is forced upstream."""

from dataclasses import dataclass
from datetime import datetime

from skrendam.scanning.types import FareItinerary

# Discount floor when a template sets no min_discount_pct (the scorer's
# "strong anomaly" veto). Lives here so discovery and verification share it.
STRONG_ANOMALY_DISCOUNT = 0.20

# Family-friendly defaults (spec 2026-09-10 §2.2 "departure ≥ 07:00"; the arrival
# ceiling is the plan's D3 default). A template's explicit hour columns win.
FAMILY_EARLIEST_DEP_HOUR = 7
FAMILY_LATEST_ARR_HOUR = 23


def _hour(leg, key: str) -> int | None:
    value = leg.get(key) if isinstance(leg, dict) else None
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).hour
    except (ValueError, TypeError):
        return None


def leg_hour_bounds(fare: FareItinerary) -> tuple[int | None, int | None]:
    """(earliest departure hour, latest arrival hour) across ALL legs.

    Every leg counts, not just the first departure and the last arrival. Legs are
    flattened across directions (live_backend), so on a round trip this spans the
    return leg too — and family templates are max 1 stop with no overnight
    layover, which makes a 05:30 connecting or return departure exactly what the
    persona rule forbids. None when the snapshot has no usable times (older rows,
    test fixtures) — unknown must never fail a gate.
    """
    legs = fare.legs or []
    deps = [h for leg in legs if (h := _hour(leg, "departure_time")) is not None]
    arrs = [h for leg in legs if (h := _hour(leg, "arrival_time")) is not None]
    return (min(deps) if deps else None), (max(arrs) if arrs else None)


def times_ok(fare: FareItinerary, tpl) -> bool:
    """Time-of-day gate: seeded since June 2026, enforced since 2026-09 (spec WP2.1)."""
    earliest = getattr(tpl, "earliest_departure_hour", None)
    latest = getattr(tpl, "latest_arrival_hour", None)
    if getattr(tpl, "family_friendly_times_only", False):
        earliest = FAMILY_EARLIEST_DEP_HOUR if earliest is None else earliest
        latest = FAMILY_LATEST_ARR_HOUR if latest is None else latest
    if earliest is None and latest is None:
        return True
    dep, arr = leg_hour_bounds(fare)
    if earliest is not None and dep is not None and dep < earliest:
        return False
    if latest is not None and arr is not None and arr >= latest:
        return False
    return True


def eff(tpl, zone, name):
    """Template value if set, else the zone default."""
    v = getattr(tpl, name, None)
    return v if v is not None else getattr(zone, name, None)


@dataclass(frozen=True)
class Gates:
    """The effective price gates of a template (None = not set, passes)."""

    min_discount_pct: float | None
    price_threshold_eur: float | None  # tpl.max_price_eur; zone ceiling for one-way only
    psychological_price_threshold_eur: float | None


def gates_for(tpl, zone) -> Gates:
    """Effective price gates via ``eff``; the zone ceiling is a one-way fallback only —
    round-trip templates must set their own ``max_price_eur``."""
    ceiling = getattr(tpl, "max_price_eur", None)
    if ceiling is None and getattr(tpl, "trip_type", None) == "oneway":
        ceiling = getattr(zone, "threshold_price_eur", None)
    return Gates(
        min_discount_pct=eff(tpl, zone, "min_discount_pct"),
        price_threshold_eur=ceiling,
        psychological_price_threshold_eur=getattr(tpl, "psychological_price_threshold_eur", None),
    )


def discount_frac(price: float, median: float | None) -> float:
    """(median - price) / median; 0 when the median is missing or non-positive
    (mirrors ``Baseline.local_discount``)."""
    if median is None or median <= 0:
        return 0.0
    return (median - price) / median


def under_ceiling(price: float, gates: Gates) -> bool:
    return gates.price_threshold_eur is not None and price <= gates.price_threshold_eur


def under_psych(price: float, gates: Gates) -> bool:
    return (
        gates.psychological_price_threshold_eur is not None
        and price <= gates.psychological_price_threshold_eur
    )


def price_anomaly_ok(price: float, median: float | None, gates: Gates) -> bool:
    """Discovery's price predicate: still a deal when the discount vs ``median`` reaches
    the template floor OR the fare is under the ceiling OR under the psychological price.

    The floor is ``min_discount_pct`` when set, else ``STRONG_ANOMALY_DISCOUNT``.
    ``allow_smaller_discount_if_under_price`` needs no branch: it only zeroes the needed
    discount when the fare is under the psychological price, which passes on its own.
    The abs-saving floor is a soft marketability signal in the scorer, never a gate.
    """
    min_disc = gates.min_discount_pct or 0
    floor = min_disc / 100.0 if min_disc > 0 else STRONG_ANOMALY_DISCOUNT
    return (
        discount_frac(price, median) >= floor
        or under_ceiling(price, gates)
        or under_psych(price, gates)
    )


def itinerary_ok(fare: FareItinerary, tpl) -> bool:
    """v1 itinerary-sanity gate (lifted from matching.match)."""
    if tpl.max_stops is not None and fare.stops > tpl.max_stops:
        return False
    if tpl.max_total_duration_minutes and fare.duration_minutes > tpl.max_total_duration_minutes:
        return False
    if not tpl.allow_self_transfer and fare.self_transfer:
        return False
    if not tpl.allow_mixed_cabin and fare.mixed_cabin:
        return False
    if not tpl.allow_airport_change and fare.airport_change:
        return False
    if not tpl.allow_overnight_layover and fare.overnight_layover:
        return False
    if not times_ok(fare, tpl):
        return False
    return True


_DOW = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def in_template_scope(tpl, route, point, today) -> bool:
    """Destination + date-window scope check (re-homed from orchestrator)."""
    from skrendam.scanning.resolver import _destinations_ok, _window

    if not _destinations_ok(tpl, route):
        return False
    # Despite the "preferred" name this is a hard gate: last-minute-weekends
    # promises "Leave this weekend", so a Wednesday fare must not match it.
    # (Audit 2026-08-29: the field was seeded but never consumed - 33/51 live
    # matches departed Sun-Thu.)
    if tpl.preferred_departure_days and _DOW[point.travel_date.weekday()] not in [
        d.upper() for d in tpl.preferred_departure_days
    ]:
        return False
    start, end = _window(tpl, today)
    return start <= point.travel_date <= end
