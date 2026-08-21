from datetime import date, timedelta

from skrendam.fli_adapter.live_backend import LiveFliBackend
from skrendam.scanning.types import SearchSpec

# fli's FlightSegment rejects travel dates in the past, so these windows must be
# relative to today — hardcoded dates turn this file into a time bomb.
START = date.today() + timedelta(days=30)
END = START + timedelta(days=30)


def test_build_date_filters_roundtrip_has_two_segments():
    b = LiveFliBackend()
    spec = SearchSpec("VNO", "BCN", "roundtrip", START, END, 7, "ECONOMY")
    f = b._build_date_filters(spec)  # must NOT raise ValidationError
    assert len(f.flight_segments) == 2
    # return segment is dest->origin, duration_days after the outbound start
    out_seg, ret_seg = f.flight_segments
    assert out_seg.travel_date == START.strftime("%Y-%m-%d")
    assert ret_seg.travel_date == (START + timedelta(days=7)).strftime("%Y-%m-%d")


def test_build_date_filters_oneway_has_one_segment():
    b = LiveFliBackend()
    spec = SearchSpec("VNO", "BCN", "oneway", START, END, None, "ECONOMY")
    f = b._build_date_filters(spec)
    assert len(f.flight_segments) == 1
    assert f.flight_segments[0].travel_date == START.strftime("%Y-%m-%d")
