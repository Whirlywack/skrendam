from datetime import date

import pytest

from fli.search.exceptions import SearchConnectionError, SearchHTTPError, SearchTimeoutError
from skrendam.fli_adapter.adapter import FliAdapter, _classify
from skrendam.fli_adapter.errors import (
    ConnectionError_ as SkConnectionError,
)
from skrendam.fli_adapter.errors import (
    ParseError,
    RateLimitedError,
    ScanError,
)
from skrendam.fli_adapter.errors import (
    TimeoutError_ as SkTimeout,
)
from skrendam.scanning.types import SearchSpec


class FakeBackend:
    def __init__(self):  # noqa: D107
        self.calendar_calls = 0

    def search_calendar(self, spec):
        self.calendar_calls += 1
        return [(date(2026, 7, 29), None, 30.0), (date(2026, 7, 30), None, 55.0)]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [
            {
                "price": 30.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}, "flight_number": "1913"}],
                "self_transfer": False,
                "mixed_cabin": False,
                "booking_url": "https://x",
            }
        ]


def _spec():
    return SearchSpec("VNO", "BCN", "oneway", date(2026, 7, 1), date(2026, 8, 31), None)


def test_calendar_results_are_cached_within_run():
    backend = FakeBackend()
    adapter = FliAdapter(backend, pace=lambda: None)
    a = adapter.search_calendar(_spec())
    b = adapter.search_calendar(_spec())  # identical spec
    assert backend.calendar_calls == 1  # served from cache the 2nd time
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
        raise AssertionError("expected error")
    except RateLimitedError:
        pass


class _EmptyBackend(FakeBackend):
    def search_calendar(self, spec):
        return []

    def search_flights(self, *a, **k):
        return []


def test_call_log_records_data_and_skips_cache_hits():
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    adapter.search_calendar(_spec())
    adapter.search_calendar(_spec())  # cache hit -> no record
    assert [(r.kind, r.outcome, r.rows) for r in adapter.call_log.records] == [
        ("calendar", "data", 2)
    ]


def test_call_log_records_empty_outcomes():
    adapter = FliAdapter(_EmptyBackend(), pace=lambda: None)
    adapter.search_calendar(_spec())
    adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    assert [(r.kind, r.outcome) for r in adapter.call_log.records] == [
        ("calendar", "empty"),
        ("flights", "empty"),
    ]


def test_call_log_records_classified_error():
    class Boom(FakeBackend):
        def search_flights(self, *a, **k):
            raise RuntimeError("HTTP 429")

    adapter = FliAdapter(Boom(), pace=lambda: None)
    with pytest.raises(RateLimitedError):
        adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    (rec,) = adapter.call_log.records
    assert rec.outcome == "error"
    assert rec.error_kind == "RateLimitedError"
    assert rec.route == "VNO-BCN" and rec.kind == "flights"


def test_classify_uses_fli_typed_exceptions():
    assert isinstance(_classify(SearchHTTPError("blocked", status_code=429)), RateLimitedError)
    assert isinstance(_classify(SearchHTTPError("server", status_code=503)), ScanError)
    assert not isinstance(_classify(SearchHTTPError("server", status_code=503)), RateLimitedError)
    assert isinstance(_classify(SearchTimeoutError("slow")), SkTimeout)
    assert isinstance(_classify(SearchConnectionError("dns")), SkConnectionError)


def test_parse_error_is_recorded_with_its_type():
    class BadShape(FakeBackend):
        def search_flights(self, *a, **k):
            return [{"price": "not-a-number"}]

    adapter = FliAdapter(BadShape(), pace=lambda: None)
    with pytest.raises(ParseError):
        adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    (rec,) = adapter.call_log.records
    assert rec.outcome == "error" and rec.error_kind == "ParseError"


def test_search_flights_cached_per_itinerary_key():
    calls = []

    class CountingBackend:
        def search_flights(self, origin, destination, travel_date, return_date, cabin):
            calls.append((origin, destination, travel_date, return_date, cabin))
            return [
                {
                    "price": 100.0,
                    "currency": "EUR",
                    "stops": 0,
                    "duration": 100,
                    "legs": [],
                    "self_transfer": False,
                    "mixed_cabin": False,
                    "booking_url": None,
                }
            ]

    a = FliAdapter(CountingBackend(), pace=lambda: None)
    d = date(2026, 9, 1)
    first = a.search_flights("VNO", "BCN", d, None, "ECONOMY")
    second = a.search_flights("VNO", "BCN", d, None, "ECONOMY")  # cache hit
    a.search_flights("VNO", "BCN", d, date(2026, 9, 8), "ECONOMY")  # different key

    assert len(calls) == 2  # second identical call never hit the network
    assert a.api_calls == 2  # cache hits don't count as api calls
    assert a.call_log.count("flights") == 2  # ...nor as call-log records
    assert first == second


def test_search_flights_error_is_not_cached():
    calls = []

    class FlakyBackend:
        def search_flights(self, origin, destination, travel_date, return_date, cabin):
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("transient failure")
            return [
                {
                    "price": 42.0,
                    "currency": "EUR",
                    "stops": 0,
                    "duration": 120,
                    "legs": [],
                    "self_transfer": False,
                    "mixed_cabin": False,
                    "booking_url": None,
                }
            ]

    adapter = FliAdapter(FlakyBackend(), pace=lambda: None)
    d = date(2026, 9, 1)

    with pytest.raises(ScanError):
        adapter.search_flights("VNO", "BCN", d, None, "ECONOMY")

    fares = adapter.search_flights("VNO", "BCN", d, None, "ECONOMY")

    assert len(calls) == 2  # backend was called again — error was not cached
    assert fares[0].price == 42.0
