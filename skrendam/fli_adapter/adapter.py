"""The only module that talks to a flight-search backend. Pure plumbing + caching."""

from collections.abc import Callable
from datetime import date

from fli.search.exceptions import SearchConnectionError, SearchHTTPError, SearchTimeoutError
from skrendam.fli_adapter.errors import (
    ConnectionError_,
    ParseError,
    RateLimitedError,
    ScanError,
    TimeoutError_,
)
from skrendam.fli_adapter.health import CallLog
from skrendam.scanning.types import CalendarPoint, FareItinerary, SearchSpec


def _classify(exc: Exception) -> ScanError:
    """Map a backend exception to a typed ScanError.

    fli raises a typed SearchClientError family — match on type first. The
    string heuristics remain only as a fallback for non-fli exceptions.
    """
    if isinstance(exc, SearchHTTPError):
        if exc.status_code == 429:
            return RateLimitedError(str(exc))
        return ScanError(f"http {exc.status_code}: {exc}")
    if isinstance(exc, SearchTimeoutError):
        return TimeoutError_(str(exc))
    if isinstance(exc, SearchConnectionError):
        return ConnectionError_(str(exc))
    msg = str(exc).lower()
    if "429" in msg or "rate" in msg:
        return RateLimitedError(str(exc))
    if "timed out" in msg or "timeout" in msg:
        return TimeoutError_(str(exc))
    if "connect" in msg or "dns" in msg:
        return ConnectionError_(str(exc))
    return ScanError(str(exc))


class FliAdapter:
    """Adapter between the scanning orchestrator and a flight-search backend.

    Handles caching, rate pacing, outcome logging, and typed error wrapping.
    """

    def __init__(self, backend, pace: Callable[[], None]) -> None:
        """Initialise the adapter with a backend and a pace callable.

        Args:
            backend: Object with search_calendar and search_flights methods.
            pace: Called before each network request to enforce rate limits.

        """
        self._backend = backend
        self._pace = pace
        self._cache: dict[tuple, list[CalendarPoint]] = {}
        self.api_calls = 0
        self.call_log = CallLog()

    def search_calendar(self, spec: SearchSpec) -> list[CalendarPoint]:
        """Search for calendar price points matching spec, with in-process caching.

        Args:
            spec: The search specification describing origin, destination, and filters.

        Returns:
            List of CalendarPoint results, possibly empty.

        Raises:
            ScanError: Or a subclass if the backend raises any exception.

        """
        key = (
            spec.origin,
            spec.destination,
            spec.trip_type,
            spec.window_start,
            spec.window_end,
            spec.duration_days,
            spec.cabin,
        )
        if key in self._cache:
            return self._cache[key]
        route = f"{spec.origin}-{spec.destination}"
        self._pace()
        self.api_calls += 1
        try:
            rows = self._backend.search_calendar(spec)
            points = [CalendarPoint(td, rd, float(p)) for (td, rd, p) in rows]
        except ScanError as err:
            self.call_log.record(
                "calendar",
                route,
                spec.trip_type,
                "error",
                error_kind=type(err).__name__,
                error_msg=str(err),
            )
            raise
        except Exception as exc:  # noqa: BLE001 — re-raised as typed ScanError
            err = _classify(exc)
            self.call_log.record(
                "calendar",
                route,
                spec.trip_type,
                "error",
                error_kind=type(err).__name__,
                error_msg=str(exc),
            )
            raise err from exc
        self.call_log.record(
            "calendar", route, spec.trip_type, "data" if points else "empty", rows=len(points)
        )
        self._cache[key] = points
        return points

    def search_flights(
        self, origin: str, destination: str, travel_date: date, return_date: date | None, cabin: str
    ) -> list[FareItinerary]:
        """Search for fare itineraries for a specific date and cabin.

        Args:
            origin: IATA code for the departure airport.
            destination: IATA code for the arrival airport.
            travel_date: Outbound travel date.
            return_date: Return date, or None for one-way trips.
            cabin: Cabin class string, e.g. ``"ECONOMY"``.

        Returns:
            List of FareItinerary results, possibly empty.

        Raises:
            ScanError: Or a subclass if the backend raises any exception.

        """
        route = f"{origin}-{destination}"
        trip_type = "roundtrip" if return_date is not None else "oneway"
        self._pace()
        self.api_calls += 1
        try:
            raw = self._backend.search_flights(origin, destination, travel_date, return_date, cabin)
            fares = [self._to_itinerary(r) for r in raw]
        except ScanError as err:  # e.g. ParseError from _to_itinerary
            self.call_log.record(
                "flights",
                route,
                trip_type,
                "error",
                error_kind=type(err).__name__,
                error_msg=str(err),
            )
            raise
        except Exception as exc:  # noqa: BLE001
            err = _classify(exc)
            self.call_log.record(
                "flights",
                route,
                trip_type,
                "error",
                error_kind=type(err).__name__,
                error_msg=str(exc),
            )
            raise err from exc
        self.call_log.record(
            "flights", route, trip_type, "data" if fares else "empty", rows=len(fares)
        )
        return fares

    @staticmethod
    def _to_itinerary(r: dict) -> FareItinerary:
        try:
            return FareItinerary(
                price=float(r["price"]),
                currency=r.get("currency", "EUR"),
                stops=int(r.get("stops", 0)),
                duration_minutes=int(r.get("duration", 0)),
                legs=r.get("legs", []),
                self_transfer=bool(r.get("self_transfer", False)),
                mixed_cabin=bool(r.get("mixed_cabin", False)),
                booking_url=r.get("booking_url"),
                raw=r,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ParseError(f"unexpected flight shape: {exc}") from exc
