"""Shared pure gate helpers. Scorers may apply these; none is forced upstream."""

from skrendam.scanning.types import FareItinerary


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
