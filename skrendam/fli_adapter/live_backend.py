"""Real fli wiring. The only place that builds fli filter objects + calls the network."""

import logging
from datetime import timedelta

from skrendam.config import Settings
from skrendam.scanning.types import SearchSpec

_log = logging.getLogger(__name__)

# A layover counts as overnight when it crosses a calendar-date boundary and is
# long enough that the traveller is actually stranded for the night (not a
# 23:50 -> 00:30 connection).
_OVERNIGHT_MIN_MINUTES = 240


def _seat_type(cabin: str):
    """Map the engine's cabin string to fli's SeatType, defaulting loudly."""
    from fli.models import SeatType

    try:
        return SeatType[cabin]
    except KeyError:
        _log.warning("unknown cabin %r; falling back to ECONOMY", cabin)
        return SeatType.ECONOMY


def _direction_metrics(legs) -> dict:
    """Layover-derived facts for ONE direction's ordered legs."""
    airport_change = False
    overnight = False
    max_layover = None
    for prev, nxt in zip(legs, legs[1:], strict=False):
        if prev.arrival_airport != nxt.departure_airport:
            airport_change = True
        layover_min = int((nxt.departure_datetime - prev.arrival_datetime).total_seconds() // 60)
        if max_layover is None or layover_min > max_layover:
            max_layover = layover_min
        if (
            nxt.departure_datetime.date() > prev.arrival_datetime.date()
            and layover_min >= _OVERNIGHT_MIN_MINUTES
        ):
            overnight = True
    return {
        "airport_change": airport_change,
        "overnight_layover": overnight,
        "max_layover_minutes": max_layover,
    }


class LiveFliBackend:
    """Adapts fli's SearchDates/SearchFlights to the (calendar, flights) interface."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings()

    def _build_date_filters(self, spec: SearchSpec):
        from fli.models import Airport, DateSearchFilters, FlightSegment, PassengerInfo, TripType

        is_rt = spec.trip_type == "roundtrip"
        segments = [
            FlightSegment(
                departure_airport=[[getattr(Airport, spec.origin), 0]],
                arrival_airport=[[getattr(Airport, spec.destination), 0]],
                travel_date=spec.window_start.strftime("%Y-%m-%d"),
            )
        ]
        if is_rt:
            ret_date = spec.window_start + timedelta(days=spec.duration_days or 0)
            segments.append(
                FlightSegment(
                    departure_airport=[[getattr(Airport, spec.destination), 0]],
                    arrival_airport=[[getattr(Airport, spec.origin), 0]],
                    travel_date=ret_date.strftime("%Y-%m-%d"),
                )
            )
        return DateSearchFilters(
            trip_type=TripType.ROUND_TRIP if is_rt else TripType.ONE_WAY,
            passenger_info=PassengerInfo(adults=1),
            flight_segments=segments,
            seat_type=_seat_type(spec.cabin),
            from_date=spec.window_start.strftime("%Y-%m-%d"),
            to_date=spec.window_end.strftime("%Y-%m-%d"),
            duration=spec.duration_days if is_rt else None,
        )

    def search_calendar(self, spec: SearchSpec):
        from fli.search import SearchDates

        filters = self._build_date_filters(spec)
        results = (
            SearchDates().search(
                filters,
                currency=self.settings.currency,
                language=self.settings.language,
                country=self.settings.country,
            )
            or []
        )
        out = []
        for r in results:
            td = r.date[0].date() if hasattr(r.date[0], "date") else r.date[0]
            rd = None
            if spec.duration_days:
                rd = td + timedelta(days=spec.duration_days)
            out.append((td, rd, float(r.price)))
        return out

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        from fli.models import (
            Airport,
            FlightSearchFilters,
            FlightSegment,
            MaxStops,
            PassengerInfo,
            SortBy,
            TripType,
        )
        from fli.search import SearchFlights

        segs = [
            FlightSegment(
                departure_airport=[[getattr(Airport, origin), 0]],
                arrival_airport=[[getattr(Airport, destination), 0]],
                travel_date=travel_date.strftime("%Y-%m-%d"),
            )
        ]
        trip = TripType.ONE_WAY
        if return_date is not None:
            trip = TripType.ROUND_TRIP
            segs.append(
                FlightSegment(
                    departure_airport=[[getattr(Airport, destination), 0]],
                    arrival_airport=[[getattr(Airport, origin), 0]],
                    travel_date=return_date.strftime("%Y-%m-%d"),
                )
            )
        filters = FlightSearchFilters(
            trip_type=trip,
            passenger_info=PassengerInfo(adults=1),
            flight_segments=segs,
            stops=MaxStops.ANY,
            seat_type=_seat_type(cabin),
            sort_by=SortBy.CHEAPEST,
        )
        client = SearchFlights()
        results = (
            client.search(
                filters,
                currency=self.settings.currency,
                language=self.settings.language,
                country=self.settings.country,
            )
            or []
        )
        out = []
        for f in results:
            # Round trips arrive as (outbound, return) tuples; each direction is a
            # FlightResult whose .duration already includes its layovers.
            directions = [
                d for d in (f if isinstance(f, tuple) else (f,)) if getattr(d, "legs", None)
            ]
            if not directions:
                continue
            head = directions[0]
            metrics = [_direction_metrics(d.legs) for d in directions]
            layovers = [
                m["max_layover_minutes"] for m in metrics if m["max_layover_minutes"] is not None
            ]
            out.append(
                {
                    "price": head.price,
                    "currency": getattr(head, "currency", "EUR") or "EUR",
                    # Sanity gates read per-direction worst case, not outbound-only.
                    "stops": max(len(d.legs) - 1 for d in directions),
                    "duration": sum(d.duration for d in directions),
                    "legs": [
                        {
                            "airline": {"code": getattr(leg.airline, "name", str(leg.airline))},
                            "flight_number": leg.flight_number,
                            "departure_airport": getattr(
                                leg.departure_airport, "name", str(leg.departure_airport)
                            ),
                            "arrival_airport": getattr(
                                leg.arrival_airport, "name", str(leg.arrival_airport)
                            ),
                            "departure_time": leg.departure_datetime.isoformat(),
                            "arrival_time": leg.arrival_datetime.isoformat(),
                        }
                        for d in directions
                        for leg in d.legs
                    ],
                    "self_transfer": any(getattr(d, "self_transfer", False) for d in directions),
                    "mixed_cabin": any(getattr(d, "mixed_cabin", False) for d in directions),
                    "airport_change": any(m["airport_change"] for m in metrics),
                    "overnight_layover": any(m["overnight_layover"] for m in metrics),
                    "max_layover_minutes": max(layovers) if layovers else None,
                    "booking_url": client.build_flight_booking_url(
                        f, currency=self.settings.currency
                    )
                    if hasattr(client, "build_flight_booking_url")
                    else None,
                }
            )
        return out
