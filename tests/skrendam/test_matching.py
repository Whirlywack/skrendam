from skrendam.db import models
from skrendam.scanning.matching import match
from skrendam.scanning.types import Baseline, FareItinerary


def _zone():
    return models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                       min_abs_savings_eur=30, min_discount_pct=25)


def _tpl(**kw):
    base = dict(slug="t", name="t", trip_type="oneway", max_stops=1, prefer_direct=False,
                allow_self_transfer=False, allow_mixed_cabin=False)
    base.update(kw)
    return models.DealTemplate(**base)


def _fare(price=30, stops=0, dur=215, **kw):
    return FareItinerary(price=price, currency="EUR", stops=stops, duration_minutes=dur,
                         legs=[{"airline": {"code": "W6"}}], **kw)


BASE = Baseline(minimum=30, median=60, decile=34, sample_size=20)


def test_strong_cheap_clean_fare_matches():
    r = match(_fare(price=30), _tpl(), BASE, _zone())
    assert r is not None
    assert r.match_score > 0.6
    assert "below" in r.reason_text.lower()
    assert r.gate_results["price_anomaly"] is True
    assert r.gate_results["itinerary_sanity"] is True


def test_fare_above_threshold_and_baseline_is_rejected():
    assert match(_fare(price=59), _tpl(max_price_eur=40, min_discount_pct=25), BASE, _zone()) is None


def test_too_many_stops_fails_itinerary_gate():
    assert match(_fare(price=30, stops=2), _tpl(max_stops=1), BASE, _zone()) is None


def test_self_transfer_rejected_when_not_allowed():
    assert match(_fare(price=30, self_transfer=True), _tpl(allow_self_transfer=False),
                 BASE, _zone()) is None


def test_smaller_discount_allowed_under_psychological_price():
    # 10% below baseline (weak) but under EUR40 psychological threshold with the relax flag on.
    tpl = _tpl(min_discount_pct=25, psychological_price_threshold_eur=40,
               allow_smaller_discount_if_under_price=True)
    assert match(_fare(price=39), tpl, BASE, _zone()) is not None
