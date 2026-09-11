"""Parity: verification's "still a deal" predicate IS discovery's publish decision."""

import itertools
from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.eligibility import Gates, gates_for, price_anomaly_ok
from skrendam.scanning.scoring.weighted import WeightedScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _tpl(**over):
    base = {
        "trip_type": "oneway",
        "max_price_eur": None,
        "min_discount_pct": None,
        "min_abs_savings_eur": None,
        "psychological_price_threshold_eur": None,
        "allow_smaller_discount_if_under_price": False,
        "max_stops": None,
        "max_total_duration_minutes": None,
        "allow_self_transfer": True,
        "allow_mixed_cabin": True,
        "allow_airport_change": True,
        "allow_overnight_layover": True,
    }
    base.update(over)
    return SimpleNamespace(**base)


ZONE = SimpleNamespace(threshold_price_eur=45.0, min_discount_pct=25.0, min_abs_savings_eur=20.0)


def _publishes(price, baseline, tpl) -> bool:
    fare = FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[])
    base = Baseline(minimum=baseline * 0.5, median=baseline, decile=baseline * 0.6, sample_size=60)
    return WeightedScorer().score(ScoringContext(fare, base, ZONE, tpl)) is not None


def test_price_anomaly_ok_matches_the_scorer_on_a_grid():
    prices = [20.0, 39.0, 40.0, 42.0, 43.0, 45.0, 46.0, 55.0, 70.0, 93.0, 124.0, 150.0, 220.0]
    baselines = [50.0, 60.0, 200.0, 275.0]
    templates = [
        _tpl(
            trip_type=tt,
            max_price_eur=mp,
            min_discount_pct=md,
            psychological_price_threshold_eur=ps,
            allow_smaller_discount_if_under_price=allow,
        )
        for tt, mp, md, ps, allow in itertools.product(
            ("oneway", "roundtrip"), (None, 100.0), (None, 25.0, 40.0), (None, 40.0), (False, True)
        )
    ]
    checked = 0
    for price, baseline, tpl in itertools.product(prices, baselines, templates):
        expected = _publishes(price, baseline, tpl)
        assert price_anomaly_ok(price, baseline, gates_for(tpl, ZONE)) is expected, (
            price,
            baseline,
            vars(tpl),
        )
        checked += 1
    assert checked == len(prices) * len(baselines) * len(templates)


def test_review_counter_examples_publish_and_verify_alike():
    last_minute = _tpl(
        psychological_price_threshold_eur=40.0, allow_smaller_discount_if_under_price=True
    )
    xmas = _tpl(trip_type="roundtrip", min_discount_pct=25.0)
    for price, baseline, tpl in [
        (39.0, 50.0, last_minute),
        (43.0, 50.0, last_minute),
        (70.0, 200.0, last_minute),
        (42.0, 60.0, xmas),
        (93.0, 275.0, xmas),
        (124.0, 275.0, xmas),
    ]:
        assert _publishes(price, baseline, tpl)
        assert price_anomaly_ok(price, baseline, gates_for(tpl, ZONE))


def test_gates_for_reads_template_then_zone():
    assert gates_for(_tpl(), ZONE) == Gates(25.0, 45.0, None)
    assert gates_for(_tpl(trip_type="roundtrip"), ZONE) == Gates(25.0, None, None)
    assert gates_for(_tpl(max_price_eur=80.0, min_discount_pct=40.0), ZONE) == Gates(
        40.0, 80.0, None
    )
