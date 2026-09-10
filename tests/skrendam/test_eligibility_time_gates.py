from skrendam.db import models
from skrendam.scanning.scoring.eligibility import itinerary_ok, leg_hour_bounds, times_ok
from skrendam.scanning.types import FareItinerary


def _legs(*pairs) -> FareItinerary:
    """FareItinerary whose legs carry the given (departure_time, arrival_time) pairs."""
    legs = [{"departure_time": dep, "arrival_time": arr} for dep, arr in pairs]
    return FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=legs)


def _fare(dep: str | None, arr: str | None) -> FareItinerary:
    """Two-leg round trip: outbound `dep` → 09:10, return 18:00 → `arr`."""
    if not (dep or arr):
        return FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=[])
    return _legs((dep, "2026-10-30T09:10:00"), ("2026-11-06T18:00:00", arr))


def _tpl(**over) -> models.DealTemplate:
    return models.DealTemplate(slug="t", name="t", trip_type="roundtrip", **over)


def test_leg_hour_bounds_span_every_leg_not_just_the_first_and_last():
    # Outbound 09:00→13:00, return 05:30→11:00: the EARLIEST departure is the
    # return's 05:30 and the LATEST arrival is the outbound's 13:00.
    fare = _legs(
        ("2026-10-30T09:00:00", "2026-10-30T13:00:00"),
        ("2026-11-06T05:30:00", "2026-11-06T11:00:00"),
    )
    assert leg_hour_bounds(fare) == (5, 13)
    assert leg_hour_bounds(_fare("2026-10-30T05:50:00", "2026-11-06T23:40:00")) == (5, 23)


def test_leg_hour_bounds_is_none_without_times():
    assert leg_hour_bounds(_fare(None, None)) == (None, None)
    fare = FareItinerary(99.0, "EUR", 0, 100, legs=[{"airline": {"code": "W6"}}])
    assert leg_hour_bounds(fare) == (None, None)


def test_leg_hour_bounds_tolerates_a_malformed_non_string_time_value():
    # A non-string departure_time (e.g. an int from a corrupt snapshot) must
    # never abort the nightly scan — unknown hours are permissive, not fatal.
    legs = [{"departure_time": 123, "arrival_time": "2026-11-06T23:40:00"}]
    fare = FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=legs)
    assert leg_hour_bounds(fare) == (None, 23)


def test_family_friendly_rejects_0550_departure_and_2340_arrival():
    tpl = _tpl(family_friendly_times_only=True)
    assert not times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
    assert not times_ok(_fare("2026-10-30T09:00:00", "2026-11-06T23:40:00"), tpl)
    assert times_ok(_fare("2026-10-30T07:00:00", "2026-11-06T22:59:00"), tpl)


def test_family_friendly_rejects_an_early_return_leg_not_just_the_first_departure():
    tpl = _tpl(family_friendly_times_only=True)
    # Brief's case: a civilised outbound but a 23:50 landing AND a 05:30 return departure.
    assert not times_ok(
        _legs(
            ("2026-10-30T09:00:00", "2026-10-30T23:50:00"),
            ("2026-11-06T05:30:00", "2026-11-06T11:00:00"),
        ),
        tpl,
    )
    # Isolating case: only the RETURN departure is uncivilised — still a reject.
    assert not times_ok(
        _legs(
            ("2026-10-30T09:00:00", "2026-10-30T13:00:00"),
            ("2026-11-06T05:30:00", "2026-11-06T11:00:00"),
        ),
        tpl,
    )
    # Both legs inside the family window -> passes.
    assert times_ok(
        _legs(
            ("2026-10-30T09:00:00", "2026-10-30T13:00:00"),
            ("2026-11-06T10:00:00", "2026-11-06T14:00:00"),
        ),
        tpl,
    )


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
