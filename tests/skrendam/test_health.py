from skrendam.fli_adapter.health import ERROR_DETAIL_CAP, CallLog, assess, health_json


def _log(calendar_data=0, calendar_empty=0, flights_data=0, flights_empty=0, errors=0):
    log = CallLog()
    for _ in range(calendar_data):
        log.record("calendar", "VNO-BCN", "oneway", "data", rows=30)
    for _ in range(calendar_empty):
        log.record("calendar", "VNO-BCN", "oneway", "empty")
    for _ in range(flights_data):
        log.record("flights", "VNO-BCN", "oneway", "data", rows=5)
    for _ in range(flights_empty):
        log.record("flights", "VNO-BCN", "oneway", "empty")
    for i in range(errors):
        log.record(
            "calendar",
            "VNO-BCN",
            "oneway",
            "error",
            error_kind="TimeoutError_",
            error_msg=f"boom {i}",
        )
    return log


def test_healthy_run_passes():
    v = assess(_log(calendar_data=40, flights_data=20), price_rows=1850, prior_price_rows=1846)
    assert v.status == "healthy" and v.reasons == [] and not v.degraded


def test_empty_ratio_trips():
    v = assess(_log(calendar_data=3, calendar_empty=5), price_rows=90)
    assert v.degraded
    assert "5/8 calendar searches" in v.reasons[0]


def test_empty_ratio_needs_min_sample():
    v = assess(_log(calendar_empty=4), price_rows=0)  # 4 calls < MIN_CALENDAR_SAMPLE and < floor
    assert v.status == "healthy"


def test_no_data_floor_trips():
    v = assess(_log(calendar_empty=2, flights_empty=8), price_rows=0)  # 10 calls, 0 rows
    assert v.degraded
    assert any("0 price rows" in r for r in v.reasons)


def test_cliff_vs_prior_run():
    v = assess(_log(calendar_data=40), price_rows=12, prior_price_rows=1846)
    assert v.degraded
    assert any("cliff" in r for r in v.reasons)


def test_cliff_needs_meaningful_prior():
    v = assess(_log(calendar_data=4), price_rows=3, prior_price_rows=50)  # prior < 100
    assert v.status == "healthy"


def test_health_json_caps_error_detail():
    log = _log(calendar_data=40, errors=ERROR_DETAIL_CAP + 10)
    v = assess(log, price_rows=500)
    j = health_json(v, log)
    assert len(j["errors"]) == ERROR_DETAIL_CAP
    assert j["errors"][0] == {
        "kind": "TimeoutError_",
        "call": "calendar",
        "route": "VNO-BCN",
        "msg": "boom 0",
    }
    assert j["metrics"]["error_calls"] == ERROR_DETAIL_CAP + 10
    assert j["reasons"] == []
