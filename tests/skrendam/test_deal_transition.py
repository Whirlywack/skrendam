"""Pure state-machine tests for the WP9 live-deal verification (spec §4). No DB."""

from datetime import date, datetime

from skrendam.db import models
from skrendam.verification import (
    LIVE_STATUSES,
    MISSED_CHECKS_TO_EXPIRE,
    PRICE_DRIFT_TOLERANCE_PCT,
    DealCheck,
    Gates,
    gates_for,
    price_anomaly_ok,
    transition,
)

TODAY = date(2026, 9, 11)
GATES = Gates(
    min_discount_pct=25.0, price_threshold_eur=None, psychological_price_threshold_eur=None
)
# Seeded CITY_BREAKS zone (45 / 20 / 25) under the seeded templates the review reproduced.
LAST_MINUTE = Gates(  # last-minute-weekends: oneway, psych 40, zone ceiling 45, zone 25 %
    min_discount_pct=25.0, price_threshold_eur=45.0, psychological_price_threshold_eur=40.0
)
XMAS_MARKETS = Gates(  # christmas-markets: roundtrip (no zone ceiling), template 25 %
    min_discount_pct=25.0, price_threshold_eur=None, psychological_price_threshold_eur=None
)


def _deal(status="live", price=93.0, baseline=275.0, missed=0, travel=date(2026, 12, 4)):
    return models.PublishedDeal(
        id=4,
        candidate_id=448,
        deal_template_id=9,
        headline="h",
        origin="VNO",
        destination="STN",
        trip_type="roundtrip",
        travel_date=travel,
        return_date=date(2026, 12, 6),
        price=price,
        baseline_price=baseline,
        status=status,
        missed_checks=missed,
    )


def _check(price=None, window_min=None, available=True):
    return DealCheck(
        available=available,
        price=price,
        window_min_price=window_min,
        window_min_date=date(2026, 12, 4) if window_min is not None else None,
        source="flights",
        checked_at=datetime(2026, 9, 11, 8, 0),
    )


def _empty():
    return _check(available=False)


def _run(deal, check, *, gates=GATES, run_healthy=True):
    return transition(deal, check, gates=gates, today=TODAY, run_healthy=run_healthy)


def test_constants_match_plan():
    assert PRICE_DRIFT_TOLERANCE_PCT == 10
    assert MISSED_CHECKS_TO_EXPIRE == 2
    assert LIVE_STATUSES == ("live", "changed")


# --- empty answers (BotGuard protection) ---------------------------------------


def test_empty_on_healthy_run_counts_a_miss_but_keeps_status():
    d = _run(_deal(missed=0), _empty())
    assert d.status == "live"
    assert d.missed_checks == 1
    assert d.expired_at is None
    assert d.reason == "empty"


def test_empty_on_degraded_run_changes_nothing():
    d = _run(_deal(missed=1), _empty(), run_healthy=False)
    assert d.status == "live"
    assert d.missed_checks == 1
    assert d.expired_at is None


def test_second_consecutive_empty_on_healthy_run_expires():
    d = _run(_deal(missed=1), _empty())
    assert d.status == "expired"
    assert d.missed_checks == 2
    assert d.reason == "missing_2_days"
    assert d.expired_at == datetime(2026, 9, 11)


def test_empty_never_expires_a_changed_deal_below_the_threshold():
    d = _run(_deal(status="changed", missed=0), _empty())
    assert d.status == "changed" and d.missed_checks == 1


# --- real prices on the exact itinerary ---------------------------------------


def test_price_within_tolerance_is_live_and_resets_misses():
    d = _run(_deal(missed=1), _check(price=102.0))  # 93 * 1.10 = 102.3
    assert d.status == "live"
    assert d.missed_checks == 0
    assert d.reason == "within_tolerance"


def test_price_exactly_at_tolerance_is_live():
    d = _run(_deal(price=100.0), _check(price=110.0))
    assert d.status == "live"


def test_changed_deal_returns_to_live_when_price_is_back():
    d = _run(_deal(status="changed"), _check(price=93.0))
    assert d.status == "live"


def test_price_above_tolerance_that_is_still_a_deal_is_changed():
    d = _run(_deal(status="live", missed=1), _check(price=124.0))  # 55% off 275, saves 151
    assert d.status == "changed"
    assert d.missed_checks == 0
    assert d.expired_at is None
    assert d.reason == "price_drift"


def test_price_failing_the_discount_gate_expires():
    d = _run(_deal(), _check(price=220.0))  # 20% off 275 < 25%
    assert d.status == "expired"
    assert d.reason == "gate_failed"
    assert d.expired_at == datetime(2026, 9, 11)


def test_abs_saving_is_never_a_gate():
    """Review case C: christmas-markets €42 vs €60 (30 % off, saves €18 < zone €20) stays."""
    d = _run(_deal(price=36.0, baseline=60.0), _check(price=42.0), gates=XMAS_MARKETS)
    assert d.status == "changed" and d.reason == "price_drift"


def test_big_discount_above_the_ceiling_is_still_a_deal():
    """Review case B: last-minute-weekends €70 vs €200 (65 % off) passes on discount alone."""
    d = _run(_deal(price=60.0, baseline=200.0), _check(price=70.0), gates=LAST_MINUTE)
    assert d.status == "changed" and d.reason == "price_drift"


def test_psychological_price_keeps_a_small_discount_alive():
    """Review case A: €39 vs €50 (22 % < 25 %) is a deal because it is under the €40 psych price."""
    deal = _deal(price=39.0, baseline=50.0)
    assert _run(deal, _check(price=39.0), gates=LAST_MINUTE).status == "live"
    assert _run(deal, _check(price=None, window_min=39.0), gates=LAST_MINUTE).status == "changed"


def test_drift_under_the_zone_ceiling_is_changed_not_expired():
    """Review case A′: the same deal at €43 (+10.3 %) is under the €45 one-way ceiling."""
    d = _run(_deal(price=39.0, baseline=50.0), _check(price=43.0), gates=LAST_MINUTE)
    assert d.status == "changed" and d.reason == "price_drift"


def test_missing_baseline_certifies_nothing_but_the_thresholds():
    gates = Gates(
        min_discount_pct=25.0, price_threshold_eur=120.0, psychological_price_threshold_eur=None
    )
    assert _run(_deal(baseline=None), _check(price=119.0), gates=gates).status == "changed"
    assert _run(_deal(baseline=None), _check(price=124.0), gates=gates).status == "expired"
    assert (
        _run(_deal(baseline=None), _check(price=124.0), gates=Gates(None, None, None)).status
        == "expired"
    )


# --- exact itinerary gone, other fares that day ---------------------------------


def test_itinerary_gone_but_window_min_still_a_deal_is_changed():
    d = _run(_deal(missed=1), _check(price=None, window_min=110.0))
    assert d.status == "changed"
    assert d.missed_checks == 0
    assert d.reason == "itinerary_gone"


def test_itinerary_gone_and_window_min_fails_gates_expires():
    d = _run(_deal(), _check(price=None, window_min=230.0))
    assert d.status == "expired" and d.reason == "gate_failed"


def test_real_answer_without_any_price_is_treated_as_no_evidence():
    # Defensive: verify_deal never produces this shape, but the machine must not expire on it.
    d = _run(_deal(missed=1), _check(price=None, window_min=None))
    assert d.status == "live" and d.missed_checks == 1 and d.reason == "no_price"


# --- scope guards ---------------------------------------------------------------


def test_expired_deals_are_left_alone():
    d = _run(_deal(status="expired", missed=1), _check(price=50.0))
    assert d.status == "expired" and d.missed_checks == 1 and d.reason == "not_live"


def test_calendar_rule_is_not_applied_here():
    """A past travel_date is the sweep's business; transition only reads the check."""
    d = _run(_deal(travel=date(2026, 1, 1)), _check(price=93.0))
    assert d.status == "live"


# --- gates ----------------------------------------------------------------------


def test_price_anomaly_ok_boundaries():
    assert price_anomaly_ok(75.0, 100.0, GATES)  # 25 %: at the line
    assert not price_anomaly_ok(76.0, 100.0, GATES)  # 24 %
    assert not price_anomaly_ok(80.0, 0.0, GATES)  # a zero baseline cannot certify a discount
    assert not price_anomaly_ok(80.0, None, GATES)
    no_floor = Gates(None, None, None)
    assert price_anomaly_ok(80.0, 100.0, no_floor)  # 20 % = STRONG_ANOMALY_DISCOUNT
    assert not price_anomaly_ok(81.0, 100.0, no_floor)
    assert price_anomaly_ok(45.0, 50.0, LAST_MINUTE)  # 10 % off but at the €45 ceiling
    assert not price_anomaly_ok(46.0, 50.0, LAST_MINUTE)  # 8 % off, above both thresholds
    assert price_anomaly_ok(40.0, 41.0, LAST_MINUTE)  # psych price alone


def test_gates_for_prefers_template_values_and_falls_back_to_zone():
    zone = models.Zone(
        zone="CITY_BREAKS",
        threshold_price_eur=45.0,
        min_abs_savings_eur=20.0,
        min_discount_pct=25.0,
    )
    tpl = models.DealTemplate(
        slug="t",
        name="t",
        audience_segment_id=1,
        travel_moment_id=1,
        trip_type="oneway",
        min_discount_pct=40.0,
        min_abs_savings_eur=None,
        max_price_eur=None,
    )
    assert gates_for(tpl, zone) == Gates(40.0, 45.0, None)


def test_gates_for_round_trip_threshold_comes_only_from_the_template():
    """Mirror the discovery scorer: the zone ceiling is a one-way default only."""
    zone = models.Zone(
        zone="CITY_BREAKS",
        threshold_price_eur=45.0,
        min_abs_savings_eur=20.0,
        min_discount_pct=25.0,
    )
    tpl = models.DealTemplate(
        slug="t", name="t", audience_segment_id=1, travel_moment_id=1, trip_type="roundtrip"
    )
    assert gates_for(tpl, zone) == Gates(25.0, None, None)
    tpl.max_price_eur = 150.0
    tpl.psychological_price_threshold_eur = 40.0
    assert gates_for(tpl, zone) == Gates(25.0, 150.0, 40.0)


def test_gates_for_without_a_zone():
    tpl = models.DealTemplate(
        slug="t", name="t", audience_segment_id=1, travel_moment_id=1, trip_type="oneway"
    )
    assert gates_for(tpl, None) == Gates(None, None, None)
