from skrendam.db import models
from skrendam.scanning.scoring.eligibility import itinerary_ok, leg_hours, times_ok
from skrendam.scanning.types import FareItinerary


def _fare(dep: str | None, arr: str | None) -> FareItinerary:
    legs = []
    if dep or arr:
        legs = [
            {"departure_time": dep, "arrival_time": "2026-10-30T09:10:00"},
            {"departure_time": "2026-11-06T18:00:00", "arrival_time": arr},
        ]
    return FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=legs)


def _tpl(**over) -> models.DealTemplate:
    return models.DealTemplate(slug="t", name="t", trip_type="roundtrip", **over)


def test_leg_hours_reads_first_departure_and_last_arrival():
    assert leg_hours(_fare("2026-10-30T05:50:00", "2026-11-06T23:40:00")) == (5, 23)


def test_leg_hours_is_none_without_times():
    assert leg_hours(_fare(None, None)) == (None, None)
    fare = FareItinerary(99.0, "EUR", 0, 100, legs=[{"airline": {"code": "W6"}}])
    assert leg_hours(fare) == (None, None)


def test_leg_hours_tolerates_a_malformed_non_string_time_value():
    # A non-string departure_time (e.g. an int from a corrupt snapshot) must
    # never abort the nightly scan — unknown hours are permissive, not fatal.
    legs = [{"departure_time": 123, "arrival_time": "2026-11-06T23:40:00"}]
    fare = FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=legs)
    assert leg_hours(fare) == (None, 23)


def test_family_friendly_rejects_0550_departure_and_2340_arrival():
    tpl = _tpl(family_friendly_times_only=True)
    assert not times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
    assert not times_ok(_fare("2026-10-30T09:00:00", "2026-11-06T23:40:00"), tpl)
    assert times_ok(_fare("2026-10-30T07:00:00", "2026-11-06T22:59:00"), tpl)


def test_explicit_hours_override_family_defaults():
    tpl = _tpl(family_friendly_times_only=True, earliest_departure_hour=5)
    assert times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
    tpl2 = _tpl(latest_arrival_hour=21)  # no family flag, explicit ceiling still applies
    assert not times_ok(_fare("2026-10-30T09:00:00", "2026-11-06T22:10:00"), tpl2)


def test_missing_times_are_permissive_and_non_family_templates_ignore_hours():
    assert times_ok(_fare(None, None), _tpl(family_friendly_times_only=True))
    assert times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T23:40:00"), _tpl())


def test_itinerary_ok_applies_the_time_gate():
    tpl = _tpl(family_friendly_times_only=True, max_stops=1)
    assert not itinerary_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
