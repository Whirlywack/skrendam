from datetime import date

from skrendam.fli_adapter.live_backend import LiveFliBackend
from skrendam.scanning.types import SearchSpec


def test_build_date_filters_roundtrip_has_two_segments():
    b = LiveFliBackend()
    spec = SearchSpec("VNO", "BCN", "roundtrip", date(2026, 7, 1), date(2026, 7, 31), 7, "ECONOMY")
    f = b._build_date_filters(spec)  # must NOT raise ValidationError
    assert len(f.flight_segments) == 2
    # return segment is dest->origin, duration_days after the outbound start
    out_seg, ret_seg = f.flight_segments
    assert out_seg.travel_date == "2026-07-01"
    assert ret_seg.travel_date == "2026-07-08"  # window_start + 7


def test_build_date_filters_oneway_has_one_segment():
    b = LiveFliBackend()
    spec = SearchSpec("VNO", "BCN", "oneway", date(2026, 7, 1), date(2026, 7, 31), None, "ECONOMY")
    f = b._build_date_filters(spec)
    assert len(f.flight_segments) == 1
    assert f.flight_segments[0].travel_date == "2026-07-01"
