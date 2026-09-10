"""Demand layer (spec 2026-09-10 WP2): who wants this trip, on these dates, at this price.

Pure functions over the headline Score, the template, and the route's price
history. Not a registered Scorer — scorers only ADD matches; this layer also
DEMOTES (commodity fares) and re-ranks (date fit, destination demand). All
thresholds are module constants (spec §6); tiers stay in tiering.py.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from importlib import resources
from statistics import median

COMMODITY_FLOOR_SHARE = 0.20
FLOOR_TOLERANCE = 1.05
FLOOR_LOOKBACK_DAYS = 90  # within the 180-day prefetched series
FLOOR_MIN_DAYS = 14  # fewer scan days -> commodity_share None (unknown != commodity)
COMMODITY_CAP = 40
DATE_FIT_PEAK = 1.25
DATE_FIT_WEEKEND = 1.10
DEMAND_W = {"A": 1.00, "B": 0.85, "C": 0.70}
ABS_SAVING_FLOOR_EUR = 60  # per person, direct
ABS_SAVING_FLOOR_CONNECTING_EUR = 150
MIN_DISCOUNT_PCT = 40  # destination archetype
DATE_DEAL_MAX_RATIO = 0.60  # fare <= 60% of window_typical
WINDOW_TYPICAL_MIN_POINTS = 10
RARE_DISCOUNT_PCT = 60  # aligns with outlier.DISC_ERROR
FAMILY_SEATS = 4

# Sentinel for assess(share=...): None is a legitimate value ("unknown share"),
# so absence needs its own marker.
_UNSET = object()


@dataclass(frozen=True)
class Window:
    slug: str
    start: date
    end: date
    pref_codes: tuple[str, ...]
    return_start: date | None = None
    return_end: date | None = None
    name: str = ""  # curator-facing label (PeakWindow.name), used by content drafts

    def holds(self, travel_date: date, return_date: date | None) -> bool:
        if not (self.start <= travel_date <= self.end):
            return False
        if return_date is None:
            # One-way fare: spec's "both legs" collapses to the single leg we
            # have, so an outbound date inside the window counts as held.
            return True
        lo, hi = (self.return_start or self.start), (self.return_end or self.end)
        return lo <= return_date <= hi


@dataclass(frozen=True)
class DemandAssessment:
    score_v2: int
    archetype: str | None
    signals: dict


def windows_from_rows(rows) -> list[Window]:
    return [
        Window(
            r.slug,
            r.start_date,
            r.end_date,
            tuple(r.pref_codes or ()),
            r.return_start_date,
            r.return_end_date,
            name=getattr(r, "name", "") or "",
        )
        for r in rows
    ]


def _resource(name: str) -> dict:
    return json.loads(resources.files("skrendam").joinpath(name).read_text(encoding="utf-8"))


def load_personas() -> dict[str, list[str]]:
    return _resource("personas.json")


def load_demand_tiers() -> dict:
    return _resource("demand_tiers.json")


def persona_codes(newsletter_tag: str | None, personas: dict) -> tuple[str, ...]:
    return tuple(personas.get(newsletter_tag or "", ()))


def commodity_share(series, price: float, now: datetime) -> float | None:
    """Fraction of recent scan days whose cheapest recorded price sits at or
    below price * FLOOR_TOLERANCE — i.e. how often this fare is just the floor."""
    cutoff = now - timedelta(days=FLOOR_LOOKBACK_DAYS)
    daily_min: dict[date, float] = {}
    for p in series.points:
        if p.scanned_at < cutoff:
            continue
        d = p.scanned_at.date()
        daily_min[d] = min(daily_min.get(d, p.price), p.price)
    if len(daily_min) < FLOOR_MIN_DAYS:
        return None
    hits = sum(1 for m in daily_min.values() if m <= price * FLOOR_TOLERANCE)
    return round(hits / len(daily_min), 3)


def date_fit(
    travel_date: date, return_date: date | None, codes, windows
) -> tuple[float, Window | None]:
    # windows are checked in (start_date, id) order — the earliest-starting
    # matching window wins; overlapping windows (e.g. kaledos-2026 vs
    # home-xmas-2026) resolve deterministically.
    for w in windows:
        if set(w.pref_codes) & set(codes) and w.holds(travel_date, return_date):
            return DATE_FIT_PEAK, w
    if (
        return_date is not None
        and travel_date.weekday() in (4, 5)
        and return_date.weekday() in (6, 0)
    ):
        return DATE_FIT_WEEKEND, None
    return 1.0, None


def demand_weight(destination: str, codes, tiers: dict) -> tuple[str, float]:
    weights = tiers.get("weights", DEMAND_W)
    if "home" in codes and destination in tiers.get("vfr", ()):
        return "A", weights["A"]
    if destination in tiers.get("A", ()):
        return "A", weights["A"]
    if destination in tiers.get("B", ()):
        return "B", weights["B"]
    return "C", weights["C"]


def window_typical(series, window: Window) -> float | None:
    """Median of recorded prices for travel dates INSIDE the window.

    First use of history for a FIXED calendar window rather than the current
    calendar month: a Christmas-week fare is compared with Christmas-week fares
    from earlier scans, not with December's median. That is what makes
    Christmas-peak fares findable as deals."""
    prices = [p.price for p in series.points if window.start <= p.travel_date <= window.end]
    if len(prices) < WINDOW_TYPICAL_MIN_POINTS:
        return None
    return float(median(prices))


def assess(
    *,
    headline,
    scores,
    template,
    audience_slug: str | None,
    destination: str,
    fare,
    travel_date: date,
    return_date: date | None,
    series,
    local_median: float,
    discount_pct: float | None,
    departure_date_count: int | None,
    now: datetime,
    windows,
    personas: dict,
    tiers: dict,
    share=_UNSET,
    typical_cache: dict | None = None,
) -> DemandAssessment:
    """Assess one (fare, template) pair. Pure.

    ``share`` and ``typical_cache`` are optional precomputations for callers that
    assess the same fare against several templates: ``share`` is this fare's
    commodity share (``None`` means "unknown"), ``typical_cache`` a per-fare
    ``{window_slug: window_typical}`` memo. Both are pure caches — passing them
    cannot change the result, only skip repeated work.
    """
    codes = persona_codes(template.newsletter_tag, personas)
    if share is _UNSET:
        share = commodity_share(series, fare.price, now)
    is_commodity = share is not None and share >= COMMODITY_FLOOR_SHARE
    fit, window = date_fit(travel_date, return_date, codes, windows)
    tier, weight = demand_weight(destination, codes, tiers)
    typical = None
    if window is not None:
        if typical_cache is None:
            typical = window_typical(series, window)
        else:
            if window.slug not in typical_cache:
                typical_cache[window.slug] = window_typical(series, window)
            typical = typical_cache[window.slug]
    typical_basis = typical if typical is not None else local_median
    discount = discount_pct or 0.0
    saving_pp = round(max(0.0, local_median - fare.price), 2)
    saving_family = round(saving_pp * FAMILY_SEATS, 2) if audience_slug == "families" else None

    archetypes: list[str] = []
    if (
        window is not None
        and typical_basis > 0
        and fare.price <= DATE_DEAL_MAX_RATIO * typical_basis
    ):
        archetypes.append("date")
    rare = (
        bool(headline.signals.get("possible_error_fare"))
        or any(getattr(s, "signals", {}).get("possible_error_fare") for s in scores)
        or any(s.scorer == "error_fare" for s in scores)
        or discount >= RARE_DISCOUNT_PCT
    )
    if rare:
        archetypes.append("rare")
    floor = ABS_SAVING_FLOOR_EUR if fare.stops == 0 else ABS_SAVING_FLOOR_CONNECTING_EUR
    enough_dates = template.min_departure_dates is None or (
        departure_date_count is not None and departure_date_count >= template.min_departure_dates
    )
    if saving_pp >= floor and discount >= MIN_DISCOUNT_PCT and tier in ("A", "B") and enough_dates:
        archetypes.append("destination")
    # A commodity fare gets no archetype: the archetypes still describe WHY it
    # looked interesting (kept in signals), but "this is a date deal / rare fare"
    # is a promise the price floor contradicts (review A4).
    primary = (
        None if is_commodity
        else next((a for a in ("date", "rare", "destination") if a in archetypes), None)
    )

    applied_weight = 1.0 if primary == "rare" else weight
    score_v2 = max(0, min(100, round(headline.score_0_100 * fit * applied_weight)))
    if is_commodity:
        score_v2 = min(score_v2, COMMODITY_CAP)
    return DemandAssessment(
        score_v2=score_v2,
        archetype=primary,
        signals={
            "commodity_share": share,
            "is_commodity": is_commodity,
            "date_fit": fit,
            "demand_tier": tier,
            "demand_weight": applied_weight,
            "window_slug": window.slug if window else None,
            "window_typical": typical,
            "saving_pp": saving_pp,
            "saving_family": saving_family,
            "archetypes": archetypes,
        },
    )
