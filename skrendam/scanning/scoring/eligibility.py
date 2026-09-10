"""Shared pure gate helpers. Scorers may apply these; none is forced upstream."""

from datetime import datetime

from skrendam.scanning.types import FareItinerary

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
