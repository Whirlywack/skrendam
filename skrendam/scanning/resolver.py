"""Turn a deal template into concrete (route, window, trip_type) search specs."""

from datetime import date, timedelta

from skrendam.db import models
from skrendam.scanning.types import SearchSpec

MAX_FUTURE_DAYS = 305  # fli's ceiling


def _window(tpl: "models.DealTemplate", today: date) -> tuple[date, date]:
    if tpl.date_window_type == "relative":
        start = today + timedelta(days=tpl.rel_offset_start_days or 0)
        end = today + timedelta(days=tpl.rel_offset_end_days or 0)
    elif tpl.date_window_type == "seasonal":
        sm, sd = (int(x) for x in tpl.season_start_mmdd.split("-"))
        em, ed = (int(x) for x in tpl.season_end_mmdd.split("-"))
        start = date(today.year, sm, sd)
        end = date(today.year, em, ed)
        if end < today:                       # season already passed this year -> next year
            start = date(today.year + 1, sm, sd)
            end = date(today.year + 1, em, ed)
        start = max(start, today)             # never scan the past
    elif tpl.date_window_type == "fixed":
        start, end = tpl.fixed_start_date, tpl.fixed_end_date
        if start is None or end is None:
            return (today, today - timedelta(days=1))  # empty window – no fixed dates set
        start = max(start, today)
    else:
        raise ValueError(f"unknown date_window_type {tpl.date_window_type!r}")
    horizon = today + timedelta(days=MAX_FUTURE_DAYS)
    return start, min(end, horizon)


def _destinations_ok(tpl: "models.DealTemplate", route: "models.Route") -> bool:
    if tpl.included_origins and route.origin not in tpl.included_origins:
        return False
    if tpl.included_destinations and route.destination not in tpl.included_destinations:
        return False
    if tpl.excluded_destinations and route.destination in tpl.excluded_destinations:
        return False
    if tpl.included_zones and route.zone not in tpl.included_zones:
        return False
    return True


def resolve(tpl: "models.DealTemplate", routes: list["models.Route"],
            today: date) -> list[SearchSpec]:
    start, end = _window(tpl, today)
    if start > end:
        return []
    duration = tpl.trip_len_min_days if tpl.trip_type == "roundtrip" else None
    specs: list[SearchSpec] = []
    for r in routes:
        if not r.enabled or not _destinations_ok(tpl, r):
            continue
        specs.append(SearchSpec(r.origin, r.destination, tpl.trip_type,
                                start, end, duration, tpl.cabin or "ECONOMY"))
    return specs
