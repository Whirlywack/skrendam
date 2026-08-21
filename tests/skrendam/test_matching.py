from skrendam.db import models
from skrendam.scanning.matching import match
from skrendam.scanning.types import Baseline, FareItinerary


def _zone():
    return models.Zone(
        zone="MED",
        haul_type="short",
        threshold_price_eur=60,
        min_abs_savings_eur=30,
        min_discount_pct=25,
    )


def _tpl(**kw):
    base = {
        "slug": "t",
        "name": "t",
        "trip_type": "oneway",
        "max_stops": 1,
        "prefer_direct": False,
        "allow_self_transfer": False,
        "allow_mixed_cabin": False,
    }
    base.update(kw)
    return models.DealTemplate(**base)


def _fare(price=30, stops=0, dur=215, **kw):
    return FareItinerary(
        price=price,
        currency="EUR",
        stops=stops,
        duration_minutes=dur,
        legs=[{"airline": {"code": "W6"}}],
        **kw,
    )


BASE = Baseline(minimum=30, median=60, decile=34, sample_size=20)


def test_strong_cheap_clean_fare_matches():
    r = match(_fare(price=30), _tpl(), BASE, _zone())
    assert r is not None
    assert r.match_score > 0.6
    assert "below" in r.reason_text.lower()
    assert r.gate_results["price_anomaly"] is True
    assert r.gate_results["itinerary_sanity"] is True


def test_fare_above_threshold_and_baseline_is_rejected():
    assert (
        match(_fare(price=59), _tpl(max_price_eur=40, min_discount_pct=25), BASE, _zone()) is None
    )


def test_too_many_stops_fails_itinerary_gate():
    assert match(_fare(price=30, stops=2), _tpl(max_stops=1), BASE, _zone()) is None


def test_self_transfer_rejected_when_not_allowed():
    assert (
        match(_fare(price=30, self_transfer=True), _tpl(allow_self_transfer=False), BASE, _zone())
        is None
    )


def test_smaller_discount_allowed_under_psychological_price():
    # 10% below baseline (weak) but under EUR40 psychological threshold with the relax flag on.
    tpl = _tpl(
        min_discount_pct=25,
        psychological_price_threshold_eur=40,
        allow_smaller_discount_if_under_price=True,
    )
    assert match(_fare(price=39), tpl, BASE, _zone()) is not None


def test_template_min_discount_below_20_is_respected():
    # Fare at EUR83 vs median EUR100 = 17% discount.
    # Template has min_discount_pct=15, no zone threshold, no psychological ceiling.
    # Before fix: STRONG_ANOMALY_DISCOUNT=0.20 would veto this even though it cleared the gate.
    # After fix: discount_floor = 0.15, so 0.17 >= 0.15 -> strong_anomaly=True -> match returned.
    zone = models.Zone(
        zone="TEST",
        haul_type="short",
        threshold_price_eur=None,
        min_abs_savings_eur=0,
        min_discount_pct=None,
    )
    tpl = _tpl(
        min_discount_pct=15, max_stops=0, psychological_price_threshold_eur=None, max_price_eur=None
    )
    baseline = Baseline(minimum=80, median=100, decile=85, sample_size=20)
    fare = _fare(price=83, stops=0)  # discount = (100-83)/100 = 0.17 = 17%
    result = match(fare, tpl, baseline, zone)
    assert result is not None, "17% fare under a min_discount_pct=15 template must match"


# C5: zone ceiling scoped to one-way only
def test_roundtrip_template_ignores_oneway_zone_ceiling():
    # fare=149, median=200 (25% discount), min_discount_pct=30 on template.
    # 25% < 30% → fails the discount gate; no psychological threshold.
    # zone ceiling=150 → under_price=True would normally rescue it for one-way.
    # With trip_type="roundtrip" the zone ceiling must NOT apply → price_anomaly=False → None.
    zone = models.Zone(
        zone="MED",
        haul_type="short",
        threshold_price_eur=150.0,
        min_abs_savings_eur=0,
        min_discount_pct=None,
    )
    tpl = _tpl(trip_type="roundtrip", max_price_eur=None, min_discount_pct=30)
    baseline = Baseline(minimum=130.0, median=200.0, decile=160.0, sample_size=30)
    fare = _fare(price=149.0, stops=0, dur=240)
    assert match(fare, tpl, baseline, zone) is None, (
        "RT template must NOT pass on the one-way zone ceiling alone"
    )


def test_oneway_template_still_uses_zone_ceiling():
    # Same setup but trip_type="oneway" — zone ceiling rescues the sub-threshold fare.
    # 25% discount < 30% min required, but fare=149 <= ceiling=150 → under_price=True → passes.
    zone = models.Zone(
        zone="MED",
        haul_type="short",
        threshold_price_eur=150.0,
        min_abs_savings_eur=0,
        min_discount_pct=None,
    )
    tpl = _tpl(trip_type="oneway", max_price_eur=None, min_discount_pct=30)
    baseline = Baseline(minimum=130.0, median=200.0, decile=160.0, sample_size=30)
    fare = _fare(price=149.0, stops=0, dur=240)
    assert match(fare, tpl, baseline, zone) is not None, (
        "one-way template must still pass via the zone ceiling"
    )
