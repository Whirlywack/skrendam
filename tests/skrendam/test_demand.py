from datetime import date, datetime, timedelta

from skrendam.db import models
from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring import demand
from skrendam.scanning.scoring.base import Score
from skrendam.scanning.types import FareItinerary

NOW = datetime(2026, 10, 1)
W = demand.Window("rudens-2026", date(2026, 10, 31), date(2026, 11, 8), ("family", "weekend"))
HOME = demand.Window(
    "home-xmas-2026",
    date(2026, 12, 18),
    date(2026, 12, 23),
    ("home",),
    date(2027, 1, 2),
    date(2027, 1, 6),
)
TIERS = {"weights": {"A": 1.0, "B": 0.85, "C": 0.7}, "A": ["BCN"], "B": ["BER"], "vfr": ["STN"]}
PERSONAS = {"family_sun": ["family"], "vfr": ["home"], "last_minute": ["weekend", "last_minute"]}


def _series(day_prices: dict[int, list[float]], travel=date(2026, 11, 2)) -> PriceHistorySeries:
    """day_prices: days-before-NOW -> prices scanned that day."""
    pts = [
        HistoryPoint(scanned_at=NOW - timedelta(days=d, hours=-h), travel_date=travel, price=p)
        for d, prices in day_prices.items()
        for h, p in enumerate(prices)
    ]
    return PriceHistorySeries(route_id=1, trip_type="roundtrip", points=tuple(pts))


def test_commodity_share_counts_days_whose_min_is_within_tolerance():
    s = _series({d: [30.0 if d % 2 else 80.0, 120.0] for d in range(1, 21)})  # 20 days, 10 at 30€
    assert demand.commodity_share(s, 30.0, NOW) == 0.5
    assert demand.commodity_share(s, 31.0, NOW) == 0.5  # 30 <= 31*1.05
    assert demand.commodity_share(s, 80.0, NOW) == 1.0


def test_commodity_share_none_below_min_days_and_ignores_old_points():
    assert demand.commodity_share(_series({d: [30.0] for d in range(1, 10)}), 30.0, NOW) is None
    old = _series({d: [30.0] for d in range(100, 130)})  # all beyond FLOOR_LOOKBACK_DAYS
    assert demand.commodity_share(old, 30.0, NOW) is None


def test_date_fit_peak_needs_both_legs_inside_a_window_sharing_a_code():
    assert demand.date_fit(date(2026, 11, 2), date(2026, 11, 7), ("family",), [W]) == (
        demand.DATE_FIT_PEAK,
        W,
    )
    assert (
        demand.date_fit(date(2026, 11, 2), date(2026, 11, 12), ("family",), [W])[0] == 1.0
    )  # return outside
    assert (
        demand.date_fit(date(2026, 11, 2), date(2026, 11, 7), ("sun",), [W])[0] == 1.0
    )  # no shared code
    assert demand.date_fit(date(2026, 12, 20), date(2027, 1, 4), ("home",), [HOME]) == (
        demand.DATE_FIT_PEAK,
        HOME,
    )
    assert (
        demand.date_fit(date(2026, 12, 20), date(2026, 12, 27), ("home",), [HOME])[0] == 1.0
    )  # return not in its range


def test_date_fit_overlapping_windows_first_in_list_order_wins():
    # Two windows both hold the same fare and share a code with it; date_fit
    # must return the first one in list order (the caller sorts windows by
    # (start_date, id) before passing them in — see orchestrator.py).
    early = demand.Window("kaledos-2026", date(2026, 12, 15), date(2026, 12, 31), ("family",))
    late = demand.Window("home-xmas-2026", date(2026, 12, 20), date(2027, 1, 5), ("family",))
    travel, back = date(2026, 12, 22), date(2026, 12, 29)
    result = demand.date_fit(travel, back, ("family",), [early, late])
    assert result == (demand.DATE_FIT_PEAK, early)
    result = demand.date_fit(travel, back, ("family",), [late, early])
    assert result == (demand.DATE_FIT_PEAK, late)


def test_date_fit_weekend_is_fri_or_sat_out_and_sun_or_mon_back():
    assert (
        demand.date_fit(date(2026, 10, 9), date(2026, 10, 11), ("weekend",), [])[0]
        == demand.DATE_FIT_WEEKEND
    )  # Fri→Sun
    assert (
        demand.date_fit(date(2026, 10, 10), date(2026, 10, 12), (), [])[0]
        == demand.DATE_FIT_WEEKEND
    )  # Sat→Mon
    assert demand.date_fit(date(2026, 10, 7), date(2026, 10, 11), (), [])[0] == 1.0  # Wed out
    assert demand.date_fit(date(2026, 10, 9), None, (), [])[0] == 1.0  # one-way


def test_demand_weight_by_tier_and_vfr_for_home():
    assert demand.demand_weight("BCN", (), TIERS) == ("A", 1.0)
    assert demand.demand_weight("BER", (), TIERS) == ("B", 0.85)
    assert demand.demand_weight("XXX", (), TIERS) == ("C", 0.7)
    assert demand.demand_weight("STN", ("home",), TIERS) == ("A", 1.0)  # vfr + home persona
    assert demand.demand_weight("STN", ("weekend",), TIERS) == ("C", 0.7)


def test_window_typical_is_the_median_of_in_window_history_or_none():
    inside = _series(
        {d: [200.0, 300.0] for d in range(1, 6)}, travel=date(2026, 11, 3)
    )  # 10 points
    assert demand.window_typical(inside, W) == 250.0
    thin = _series({1: [200.0]}, travel=date(2026, 11, 3))
    assert demand.window_typical(thin, W) is None
    outside = _series({d: [200.0, 300.0] for d in range(1, 6)}, travel=date(2026, 9, 3))
    assert demand.window_typical(outside, W) is None


def _headline(score100: int, scorer="weighted", signals=None) -> Score:
    return Score(
        scorer=scorer,
        value=score100 / 100,
        score_0_100=score100,
        quality_tier=None,
        reason_text="",
        signals=signals or {},
    )


def _tpl(**over) -> models.DealTemplate:
    base = {
        "slug": "family-autumn-sun",
        "name": "x",
        "trip_type": "roundtrip",
        "newsletter_tag": "family_sun",
        "min_departure_dates": None,
    }
    base.update(over)
    return models.DealTemplate(**base)


def _fare(stops=0) -> FareItinerary:
    return FareItinerary(price=99.0, currency="EUR", stops=stops, duration_minutes=200, legs=[])


def test_assess_date_archetype_boosts_and_reports_window():
    series = _series(
        {d: [200.0, 300.0] for d in range(1, 16)}, travel=date(2026, 11, 3)
    )  # typical 250
    a = demand.assess(
        headline=_headline(80),
        scores=[_headline(80)],
        template=_tpl(),
        audience_slug="families",
        destination="XXX",
        fare=_fare(),
        travel_date=date(2026, 11, 2),
        return_date=date(2026, 11, 7),
        series=series,
        local_median=250.0,
        discount_pct=60.4,
        departure_date_count=None,
        now=NOW,
        windows=[W],
        personas=PERSONAS,
        tiers=TIERS,
    )
    assert a.archetype == "date"  # 99 <= 0.6 * 250
    assert a.score_v2 == 70  # 80 * 1.25 * 0.7 (destination unknown -> C)
    assert a.signals["window_slug"] == "rudens-2026" and a.signals["window_typical"] == 250.0
    assert a.signals["saving_pp"] == 151.0 and a.signals["saving_family"] == 604.0
    assert "rare" in a.signals["archetypes"]  # discount >= 60 also matched, lower precedence


def test_assess_commodity_caps_score_and_no_archetype():
    series = _series({d: [99.0, 150.0] for d in range(1, 21)})  # floor at 99 on every day
    a = demand.assess(
        headline=_headline(90),
        scores=[_headline(90)],
        template=_tpl(newsletter_tag="last_minute"),
        audience_slug="budget",
        destination="XXX",
        fare=_fare(),
        travel_date=date(2026, 10, 7),
        return_date=None,
        series=series,
        local_median=120.0,
        discount_pct=65.0,
        departure_date_count=None,
        now=NOW,
        windows=[W],
        personas=PERSONAS,
        tiers=TIERS,
    )
    assert a.signals["is_commodity"] is True and a.signals["commodity_share"] == 1.0
    assert a.score_v2 == demand.COMMODITY_CAP
    # 65% off would normally earn the "rare" archetype — the signal is still
    # recorded, but a fare sitting on its own floor every day promises nothing.
    assert "rare" in a.signals["archetypes"]
    assert a.archetype is None


def test_assess_rare_skips_demand_weight_and_destination_needs_floor_and_tier():
    rare = demand.assess(
        headline=_headline(90, "outlier", {"possible_error_fare": True}),
        scores=[],
        template=_tpl(newsletter_tag="last_minute"),
        audience_slug="budget",
        destination="XXX",
        fare=_fare(),
        travel_date=date(2026, 10, 7),
        return_date=None,
        series=_series({}),
        local_median=400.0,
        discount_pct=75.0,
        departure_date_count=None,
        now=NOW,
        windows=[],
        personas=PERSONAS,
        tiers=TIERS,
    )
    assert rare.archetype == "rare" and rare.score_v2 == 90  # weight 0.7 skipped
    dest = demand.assess(
        headline=_headline(80),
        scores=[_headline(80)],
        template=_tpl(newsletter_tag="last_minute", min_departure_dates=5),
        audience_slug="budget",
        destination="XXX",
        fare=_fare(stops=1),
        travel_date=date(2026, 10, 7),
        return_date=None,
        series=_series({}),
        local_median=300.0,
        discount_pct=67.0,
        departure_date_count=5,
        now=NOW,
        windows=[],
        personas=PERSONAS,
        tiers=TIERS,
    )
    # 201 € saving with a connection (>=150), discount >= 40, but destination
    # unknown -> tier C -> not destination.
    assert "destination" not in dest.signals["archetypes"]
    assert demand.assess(
        headline=_headline(80),
        scores=[],
        template=_tpl(newsletter_tag="last_minute", min_departure_dates=5),
        audience_slug="budget",
        destination="XXX",
        fare=_fare(),
        travel_date=date(2026, 10, 7),
        return_date=None,
        series=_series({}),
        local_median=300.0,
        discount_pct=67.0,
        departure_date_count=5,
        now=NOW,
        windows=[],
        personas=PERSONAS,
        tiers=TIERS | {"A": ["XXX"]},
    ).signals["archetypes"] == ["rare", "destination"]
