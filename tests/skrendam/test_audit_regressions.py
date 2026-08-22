"""Regression tests for the 2026-07 audit fixes — one focused test per finding."""

from datetime import date, datetime
from types import SimpleNamespace

import pytest

from skrendam.db import models
from skrendam.db import repositories as repo
from skrendam.fli_adapter.adapter import MAX_ROWS_PER_CALL, FliAdapter
from skrendam.fli_adapter.health import CallLog, assess
from skrendam.fli_adapter.live_backend import _direction_metrics, _seat_type
from skrendam.scanning.content import build_content_draft
from skrendam.scanning.history import DbPriceHistory
from skrendam.scanning.resolver import resolve
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.weighted import WeightedScorer
from skrendam.scanning.types import Baseline, FareItinerary

# ---------------------------------------------------------------------------
# WeightedScorer: price-anomaly term must be monotone in cheapness
# ---------------------------------------------------------------------------


def _tpl(**over):
    base = {
        "trip_type": "oneway",
        "max_price_eur": None,
        "min_discount_pct": None,
        "min_abs_savings_eur": None,
        "psychological_price_threshold_eur": None,
        "allow_smaller_discount_if_under_price": False,
        "max_stops": None,
        "max_total_duration_minutes": None,
        "allow_self_transfer": True,
        "allow_mixed_cabin": True,
        "allow_airport_change": True,
        "allow_overnight_layover": True,
    }
    base.update(over)
    return SimpleNamespace(**base)


def _zone(**over):
    base = {"threshold_price_eur": None, "min_discount_pct": None, "min_abs_savings_eur": None}
    base.update(over)
    return SimpleNamespace(**base)


def _fare(price, stops=0):
    return FareItinerary(price=price, currency="EUR", stops=stops, duration_minutes=120, legs=[])


def test_weighted_under_ceiling_fare_below_median_never_scores_worse_than_above():
    base = Baseline(minimum=90.0, median=100.0, decile=92.0, sample_size=60)
    tpl = _tpl(max_price_eur=150.0)
    zone = _zone()
    just_below = WeightedScorer().score(
        ScoringContext(fare=_fare(99.0), baseline=base, zone=zone, template=tpl)
    )
    just_above = WeightedScorer().score(
        ScoringContext(fare=_fare(101.0), baseline=base, zone=zone, template=tpl)
    )
    assert just_below is not None and just_above is not None
    assert just_below.value >= just_above.value


# ---------------------------------------------------------------------------
# Resolver: year-wrapping seasons mid-season and off-season
# ---------------------------------------------------------------------------

_WINTER_ROUTE = [models.Route(id=1, origin="VNO", destination="TFS", zone="CANARIES", enabled=True)]


def _winter_tpl():
    return models.DealTemplate(
        slug="winter-sun",
        name="x",
        trip_type="oneway",
        date_window_type="seasonal",
        season_start_mmdd="12-01",
        season_end_mmdd="02-28",
        included_zones=["CANARIES"],
    )


def test_wrapping_season_mid_january_scans_remaining_tail():
    specs = resolve(_winter_tpl(), _WINTER_ROUTE, today=date(2026, 1, 15))
    assert len(specs) == 1
    assert specs[0].window_start == date(2026, 1, 15)
    assert specs[0].window_end == date(2026, 2, 28)


def test_wrapping_season_off_season_scans_next_occurrence():
    specs = resolve(_winter_tpl(), _WINTER_ROUTE, today=date(2026, 6, 15))
    assert len(specs) == 1
    assert specs[0].window_start == date(2026, 12, 1)
    assert specs[0].window_end == date(2027, 2, 28)


# ---------------------------------------------------------------------------
# Content drafts: a curator format spec must never abort the scan
# ---------------------------------------------------------------------------


def test_content_numeric_format_spec_falls_back_to_raw_pattern():
    tpl = SimpleNamespace(
        suggested_headline_template="{price:.0f} to {destination}",
        tiktok_hook_template="{oops",
        content_angle=None,
    )
    draft = build_content_draft("VNO", "BCN", 29.0, 80.0, date(2026, 9, 1), tpl)
    # bad specs fall back verbatim instead of raising ValueError
    assert draft["headline"] == "{price:.0f} to {destination}"
    assert draft["tiktok_hook"] == "{oops"


# ---------------------------------------------------------------------------
# Health: interleaved errors and flights-level emptiness must degrade
# ---------------------------------------------------------------------------


def _log_with(cal_data=0, cal_empty=0, cal_err=0, fl_data=0, fl_empty=0):
    log = CallLog()
    for _ in range(cal_data):
        log.record("calendar", "VNO-BCN", "oneway", "data", rows=30)
    for _ in range(cal_empty):
        log.record("calendar", "VNO-BCN", "oneway", "empty")
    for _ in range(cal_err):
        log.record("calendar", "VNO-BCN", "oneway", "error", error_kind="ScanError")
    for _ in range(fl_data):
        log.record("flights", "VNO-BCN", "oneway", "data", rows=5)
    for _ in range(fl_empty):
        log.record("flights", "VNO-BCN", "oneway", "empty")
    return log


def test_interleaved_errors_degrade_even_when_breaker_never_opens():
    verdict = assess(_log_with(cal_data=5, cal_err=5), price_rows=150)
    assert verdict.degraded
    assert any("errored" in r for r in verdict.reasons)


def test_flights_level_emptiness_degrades():
    verdict = assess(_log_with(cal_data=6, fl_empty=5, fl_data=1), price_rows=180)
    assert verdict.degraded
    assert any("flight searches returned no data" in r for r in verdict.reasons)


def test_healthy_run_stays_healthy():
    verdict = assess(_log_with(cal_data=10, fl_data=4), price_rows=300)
    assert not verdict.degraded


# ---------------------------------------------------------------------------
# Price history: round-trip series partitioned by trip duration
# ---------------------------------------------------------------------------


def test_history_partitions_roundtrip_by_duration(session):
    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    run = models.ScanRun(scanner_version="t", started_at=datetime(2026, 6, 1))
    session.add(run)
    session.flush()
    for day, dur, price in [(1, 3, 120.0), (1, 14, 260.0), (2, 3, 110.0), (2, 14, 250.0)]:
        session.add(
            models.PriceLog(
                run_id=run.id,
                route_id=1,
                trip_type="roundtrip",
                travel_date=date(2026, 8, day),
                return_date=date(2026, 8, day + dur),
                price=price,
                scanner_version="t",
                scanned_at=datetime(2026, 6, day),
            )
        )
    session.commit()

    hist = DbPriceHistory(session, now=datetime(2026, 7, 1))
    short = hist.for_route(1, "roundtrip", 3)
    long = hist.for_route(1, "roundtrip", 14)
    assert [p.price for p in short.points] == [120.0, 110.0]
    assert [p.price for p in long.points] == [260.0, 250.0]
    # unfiltered view still returns everything (oneway callers pass None)
    assert len(hist.for_route(1, "roundtrip").points) == 4


# ---------------------------------------------------------------------------
# Worker: a failed request must roll back, not commit half-finished state
# ---------------------------------------------------------------------------


def test_worker_rolls_back_failed_scan_state(session, monkeypatch):
    from skrendam import worker

    req = models.ScanRequest(kind="full_scan")
    session.add(req)
    session.commit()

    def exploding_run_scan(sess, **kwargs):
        # simulate a scan that flushed work before dying
        sess.add(models.ScanRun(scanner_version="boom", started_at=datetime(2026, 7, 1)))
        sess.flush()
        raise RuntimeError("mid-scan crash")

    monkeypatch.setattr(worker, "run_scan", exploding_run_scan)
    processed = worker.process_pending_requests(
        session, lambda: None, today=date(2026, 7, 1), now=datetime(2026, 7, 1, 12, 0)
    )
    assert processed == 1
    session.expire_all()
    assert req.status == "error"
    assert "mid-scan crash" in req.error
    # the half-flushed ScanRun must NOT have survived
    assert session.query(models.ScanRun).count() == 0


# ---------------------------------------------------------------------------
# upsert_candidate: losing the insert race falls through to the update path
# ---------------------------------------------------------------------------


class _RacingSession:
    """First scalar() returns None (stale snapshot); everything else delegates."""

    def __init__(self, real):
        self._real = real
        self._missed = False

    def scalar(self, stmt):
        if not self._missed:
            self._missed = True
            return None
        return self._real.scalar(stmt)

    def __getattr__(self, name):
        return getattr(self._real, name)


def _candidate_fields():
    return {
        "route_id": 1,
        "origin": "VNO",
        "destination": "BCN",
        "zone": "MED",
        "trip_type": "oneway",
        "travel_date": date(2026, 9, 1),
        "return_date": None,
        "price": 45.0,
        "currency": "EUR",
    }


def test_upsert_candidate_survives_losing_the_race(session):
    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    now = datetime(2026, 7, 1, 6, 0)
    winner, created = repo.upsert_candidate(session, "K1", _candidate_fields(), now)
    assert created
    session.commit()

    racing = _RacingSession(session)
    later = datetime(2026, 7, 1, 15, 0)
    fields = _candidate_fields() | {"price": 39.0}
    cand, created = repo.upsert_candidate(racing, "K1", fields, later)
    assert not created
    assert cand.id == winner.id
    assert cand.price == 39.0
    assert cand.last_seen_at == later
    # session must still be usable after the rolled-back savepoint
    session.commit()
    assert session.query(models.Candidate).count() == 1


# ---------------------------------------------------------------------------
# Adapter: row clamps, booking-url allowlist, itinerary-flag passthrough
# ---------------------------------------------------------------------------


class _StubBackend:
    def __init__(self, calendar=None, flights=None):
        self._calendar = calendar or []
        self._flights = flights or []

    def search_calendar(self, spec):
        return self._calendar

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return self._flights


def _spec():
    from skrendam.scanning.types import SearchSpec

    return SearchSpec("VNO", "BCN", "oneway", date(2026, 9, 1), date(2026, 9, 30), None)


def test_adapter_truncates_oversized_calendar_response():
    rows = [(date(2026, 9, 1), None, 10.0)] * (MAX_ROWS_PER_CALL + 50)
    adapter = FliAdapter(_StubBackend(calendar=rows), pace=lambda: None)
    points = adapter.search_calendar(_spec())
    assert len(points) == MAX_ROWS_PER_CALL


def test_adapter_drops_non_google_booking_url():
    flights = [
        {"price": 30.0, "booking_url": "https://evil.example/phish"},
        {"price": 32.0, "booking_url": "https://www.google.com/travel/flights?x=1"},
    ]
    adapter = FliAdapter(_StubBackend(flights=flights), pace=lambda: None)
    fares = adapter.search_flights("VNO", "BCN", date(2026, 9, 1), None, "ECONOMY")
    assert fares[0].booking_url is None
    assert fares[1].booking_url == "https://www.google.com/travel/flights?x=1"


def test_adapter_passes_itinerary_flags_through():
    flights = [
        {
            "price": 30.0,
            "airport_change": True,
            "overnight_layover": True,
            "max_layover_minutes": 610,
        }
    ]
    adapter = FliAdapter(_StubBackend(flights=flights), pace=lambda: None)
    fare = adapter.search_flights("VNO", "BCN", date(2026, 9, 1), None, "ECONOMY")[0]
    assert fare.airport_change is True
    assert fare.overnight_layover is True
    assert fare.max_layover_minutes == 610


# ---------------------------------------------------------------------------
# Live backend: cabin mapping + per-direction leg metrics
# ---------------------------------------------------------------------------


def test_seat_type_maps_and_defaults():
    from fli.models import SeatType

    assert _seat_type("BUSINESS") is SeatType.BUSINESS
    assert _seat_type("NOT_A_CABIN") is SeatType.ECONOMY


def test_build_date_filters_carries_cabin():
    from fli.models import SeatType
    from skrendam.fli_adapter.live_backend import LiveFliBackend
    from skrendam.scanning.types import SearchSpec

    spec = SearchSpec("VNO", "BCN", "oneway", date(2026, 9, 1), date(2026, 9, 30), None, "BUSINESS")
    f = LiveFliBackend()._build_date_filters(spec)
    assert f.seat_type is SeatType.BUSINESS


def _leg(dep_air, arr_air, dep, arr):
    return SimpleNamespace(
        departure_airport=dep_air,
        arrival_airport=arr_air,
        departure_datetime=dep,
        arrival_datetime=arr,
    )


def test_direction_metrics_detects_airport_change_and_overnight():
    legs = [
        _leg("VNO", "SXF", datetime(2026, 9, 1, 20, 0), datetime(2026, 9, 1, 21, 30)),
        # next departure from a DIFFERENT Berlin airport, next morning
        _leg("BER", "BCN", datetime(2026, 9, 2, 9, 0), datetime(2026, 9, 2, 11, 45)),
    ]
    m = _direction_metrics(legs)
    assert m["airport_change"] is True
    assert m["overnight_layover"] is True
    assert m["max_layover_minutes"] == (12 * 60) - 30


def test_direction_metrics_short_past_midnight_connection_is_not_overnight():
    legs = [
        _leg("VNO", "WAW", datetime(2026, 9, 1, 22, 30), datetime(2026, 9, 1, 23, 50)),
        _leg("WAW", "BCN", datetime(2026, 9, 2, 0, 40), datetime(2026, 9, 2, 3, 30)),
    ]
    m = _direction_metrics(legs)
    assert m["airport_change"] is False
    assert m["overnight_layover"] is False
    assert m["max_layover_minutes"] == 50


def test_direction_metrics_nonstop_has_no_layover():
    legs = [_leg("VNO", "BCN", datetime(2026, 9, 1, 10, 0), datetime(2026, 9, 1, 13, 0))]
    m = _direction_metrics(legs)
    assert m == {"airport_change": False, "overnight_layover": False, "max_layover_minutes": None}


# ---------------------------------------------------------------------------
# Config: the fli_timeout no-op knob is gone; breaker threshold is wired
# ---------------------------------------------------------------------------


def test_fli_timeout_setting_removed():
    from skrendam.config import Settings

    assert not hasattr(Settings(), "fli_timeout")


def test_run_scan_accepts_real_wall_clock(session):
    """run_scan(now=...) stamps the run with the given wall clock, not midnight."""
    from skrendam.scanning.orchestrator import run_scan

    adapter = FliAdapter(_StubBackend(), pace=lambda: None)
    afternoon = datetime(2026, 7, 1, 15, 42)
    run_scan(session, today=date(2026, 7, 1), adapter=adapter, now=afternoon)
    run = session.query(models.ScanRun).one()
    assert run.started_at == afternoon
    assert run.finished_at == afternoon


@pytest.mark.parametrize("threshold", [1, 3])
def test_breaker_threshold_is_honored(session, threshold):
    """The wired-through threshold aborts after exactly `threshold` consecutive errors."""
    from skrendam.scanning.orchestrator import run_scan

    class ExplodingBackend:
        def search_calendar(self, spec):
            raise RuntimeError("boom")

        def search_flights(self, *a):
            return []

    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(models.AudienceSegment(id=1, slug="a", name="a"))
    session.add(models.TravelMoment(id=1, slug="m", name="m", moment_type="t"))
    for i in range(5):
        session.add(
            models.Route(id=i + 1, origin="VNO", destination=f"X{i}", zone="MED", core=True)
        )
    session.add(
        models.DealTemplate(
            id=1,
            slug="t",
            name="t",
            audience_segment_id=1,
            travel_moment_id=1,
            trip_type="oneway",
            date_window_type="relative",
            rel_offset_start_days=1,
            rel_offset_end_days=30,
        )
    )
    session.commit()

    adapter = FliAdapter(ExplodingBackend(), pace=lambda: None)
    summary = run_scan(
        session, today=date(2026, 7, 1), adapter=adapter, circuit_breaker_threshold=threshold
    )
    assert summary.aborted
    assert summary.errors == threshold
