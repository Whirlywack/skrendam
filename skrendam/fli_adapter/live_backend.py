"""Real fli wiring. The only place that builds fli filter objects + calls the network."""

from datetime import timedelta

from skrendam.config import Settings
from skrendam.scanning.types import SearchSpec


class LiveFliBackend:
    """Adapts fli's SearchDates/SearchFlights to the (calendar, flights) interface."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings()

    def _build_date_filters(self, spec: SearchSpec):
        from fli.models import Airport, DateSearchFilters, FlightSegment, PassengerInfo, TripType
        is_rt = spec.trip_type == "roundtrip"
        segments = [FlightSegment(
            departure_airport=[[getattr(Airport, spec.origin), 0]],
            arrival_airport=[[getattr(Airport, spec.destination), 0]],
            travel_date=spec.window_start.strftime("%Y-%m-%d"))]
        if is_rt:
            ret_date = spec.window_start + timedelta(days=spec.duration_days or 0)
            segments.append(FlightSegment(
                departure_airport=[[getattr(Airport, spec.destination), 0]],
                arrival_airport=[[getattr(Airport, spec.origin), 0]],
                travel_date=ret_date.strftime("%Y-%m-%d")))
        return DateSearchFilters(
            trip_type=TripType.ROUND_TRIP if is_rt else TripType.ONE_WAY,
            passenger_info=PassengerInfo(adults=1), flight_segments=segments,
            from_date=spec.window_start.strftime("%Y-%m-%d"),
            to_date=spec.window_end.strftime("%Y-%m-%d"),
            duration=spec.duration_days if is_rt else None)

    def search_calendar(self, spec: SearchSpec):
        from fli.search import SearchDates
        filters = self._build_date_filters(spec)
        results = SearchDates().search(filters, currency=self.settings.currency,
                                       language=self.settings.language,
                                       country=self.settings.country) or []
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
            SeatType,
            SortBy,
            TripType,
        )
        from fli.search import SearchFlights
        segs = [FlightSegment(departure_airport=[[getattr(Airport, origin), 0]],
                              arrival_airport=[[getattr(Airport, destination), 0]],
                              travel_date=travel_date.strftime("%Y-%m-%d"))]
        trip = TripType.ONE_WAY
        if return_date is not None:
            trip = TripType.ROUND_TRIP
            segs.append(FlightSegment(departure_airport=[[getattr(Airport, destination), 0]],
                                      arrival_airport=[[getattr(Airport, origin), 0]],
                                      travel_date=return_date.strftime("%Y-%m-%d")))
        filters = FlightSearchFilters(trip_type=trip, passenger_info=PassengerInfo(adults=1),
                                      flight_segments=segs, stops=MaxStops.ANY,
                                      seat_type=SeatType.ECONOMY, sort_by=SortBy.CHEAPEST)
        client = SearchFlights()
        results = client.search(filters, currency=self.settings.currency,
                                language=self.settings.language, country=self.settings.country) or []
        out = []
        for f in results:
            flight = f[0] if isinstance(f, tuple) else f
            if not getattr(flight, "legs", None):
                continue
            out.append({
                "price": flight.price, "currency": getattr(flight, "currency", "EUR") or "EUR",
                "stops": len(flight.legs) - 1,
                "duration": sum(getattr(leg, "duration", 0) for leg in flight.legs),
                "legs": [{"airline": {"code": getattr(leg.airline, "name", str(leg.airline))},
                          "flight_number": leg.flight_number} for leg in flight.legs],
                "self_transfer": getattr(flight, "self_transfer", False),
                "mixed_cabin": getattr(flight, "mixed_cabin", False),
                "booking_url": client.build_flight_booking_url(
                    f, currency=self.settings.currency) if hasattr(client, "build_flight_booking_url") else None,
            })
        return out
