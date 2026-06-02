from datetime import date

from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import RateLimitedError
from skrendam.scanning.types import SearchSpec


class FakeBackend:
    def __init__(self):
        self.calendar_calls = 0

    def search_calendar(self, spec):
        self.calendar_calls += 1
        return [(date(2026, 7, 29), None, 30.0), (date(2026, 7, 30), None, 55.0)]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}, "flight_number": "1913"}],
                 "self_transfer": False, "mixed_cabin": False, "booking_url": "https://x"}]


def _spec():
    return SearchSpec("VNO", "BCN", "oneway", date(2026, 7, 1), date(2026, 8, 31), None)


def test_calendar_results_are_cached_within_run():
    backend = FakeBackend()
    adapter = FliAdapter(backend, pace=lambda: None)
    a = adapter.search_calendar(_spec())
    b = adapter.search_calendar(_spec())          # identical spec
    assert backend.calendar_calls == 1            # served from cache the 2nd time
    assert a[0].price == 30.0 and a == b
    assert adapter.api_calls == 1


def test_flights_are_parsed_into_fare_itinerary():
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    fares = adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    assert fares[0].price == 30.0 and fares[0].stops == 0 and fares[0].duration_minutes == 215


def test_backend_error_is_wrapped(monkeypatch):
    class Boom(FakeBackend):
        def search_flights(self, *a, **k):
            raise RuntimeError("HTTP 429")
    adapter = FliAdapter(Boom(), pace=lambda: None)
    try:
        adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
        assert False, "expected error"
    except RateLimitedError:
        pass
