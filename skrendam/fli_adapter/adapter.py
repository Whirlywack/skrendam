"""The only module that talks to a flight-search backend. Pure plumbing + caching."""

from collections.abc import Callable
from datetime import date

from skrendam.fli_adapter.errors import (
    ConnectionError_,
    ParseError,
    RateLimitedError,
    ScanError,
    TimeoutError_,
)
from skrendam.scanning.types import CalendarPoint, FareItinerary, SearchSpec


def _classify(exc: Exception) -> ScanError:
    msg = str(exc).lower()
    if "429" in msg or "rate" in msg:
        return RateLimitedError(str(exc))
    if "timed out" in msg or "timeout" in msg:
        return TimeoutError_(str(exc))
    if "connect" in msg or "dns" in msg:
        return ConnectionError_(str(exc))
    return ScanError(str(exc))


class FliAdapter:
    def __init__(self, backend, pace: Callable[[], None]):
        self._backend = backend
        self._pace = pace
        self._cache: dict[tuple, list[CalendarPoint]] = {}
        self.api_calls = 0

    def search_calendar(self, spec: SearchSpec) -> list[CalendarPoint]:
        key = (spec.origin, spec.destination, spec.trip_type, spec.window_start,
               spec.window_end, spec.duration_days, spec.cabin)
        if key in self._cache:
            return self._cache[key]
        self._pace()
        self.api_calls += 1
        try:
            rows = self._backend.search_calendar(spec)
        except Exception as exc:  # noqa: BLE001 — re-raised as typed ScanError
            raise _classify(exc) from exc
        points = [CalendarPoint(td, rd, float(p)) for (td, rd, p) in rows]
        self._cache[key] = points
        return points

    def search_flights(self, origin: str, destination: str, travel_date: date,
                       return_date: date | None, cabin: str) -> list[FareItinerary]:
        self._pace()
        self.api_calls += 1
        try:
            raw = self._backend.search_flights(origin, destination, travel_date,
                                               return_date, cabin)
        except Exception as exc:  # noqa: BLE001
            raise _classify(exc) from exc
        return [self._to_itinerary(r) for r in raw]

    @staticmethod
    def _to_itinerary(r: dict) -> FareItinerary:
        try:
            return FareItinerary(
                price=float(r["price"]), currency=r.get("currency", "EUR"),
                stops=int(r.get("stops", 0)), duration_minutes=int(r.get("duration", 0)),
                legs=r.get("legs", []), self_transfer=bool(r.get("self_transfer", False)),
                mixed_cabin=bool(r.get("mixed_cabin", False)),
                booking_url=r.get("booking_url"), raw=r,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ParseError(f"unexpected flight shape: {exc}") from exc
