from datetime import date, datetime

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.scanning.orchestrator import run_scan


def _seed(session):
    session.add(
        models.Zone(
            zone="MED",
            haul_type="short",
            threshold_price_eur=60,
            min_abs_savings_eur=20,
            min_discount_pct=20,
        )
    )
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True,
                             core=True))
    aud = models.AudienceSegment(id=1, slug="budget", name="Budget")
    mom = models.TravelMoment(id=1, slug="lm", name="Last minute", moment_type="relative")
    session.add_all([aud, mom])
    session.add(
        models.DealTemplate(
            id=1,
            slug="lastminute",
            name="Last-minute",
            enabled=True,
            audience_segment_id=1,
            travel_moment_id=1,
            trip_type="oneway",
            date_window_type="relative",
            rel_offset_start_days=1,
            rel_offset_end_days=60,
            included_zones=["MED"],
            max_stops=1,
            suggested_headline_template="{origin}->{destination} EUR{price}",
        )
    )
    session.commit()


class FakeBackend:
    def search_calendar(self, spec):
        return [
            (date(2026, 7, 29), None, 30.0),
            (date(2026, 7, 30), None, 90.0),
            (date(2026, 7, 31), None, 95.0),
        ]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [
            {
                "price": 30.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}}],
                "self_transfer": False,
                "mixed_cabin": False,
                "booking_url": "https://x",
            }
        ]


def test_run_scan_produces_candidate_match_and_draft(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="test")

    assert summary.candidates_found == 1
    assert summary.matches_created == 1
    cand = session.query(models.Candidate).one()
    assert cand.origin == "VNO" and cand.price == 30.0 and cand.status == "new"
    assert session.query(models.CandidateTemplateMatch).count() == 1
    assert session.query(models.ContentDraft).count() == 1
    run = session.query(models.ScanRun).one()
    assert run.status == "completed" and run.templates_scanned == 1
    # Only the anomalous cheap date (EUR30) triggered a tier-2 detail fetch, not all 3.
    assert session.query(models.PriceLog).count() == 3  # all calendar points logged
    # started_at must be set at the same time as finished_at (same clock source).
    assert run.started_at <= run.finished_at


def test_match_less_fare_creates_no_candidate(session):
    session.add(
        models.Zone(
            zone="MED",
            haul_type="short",
            threshold_price_eur=60,
            min_abs_savings_eur=20,
            min_discount_pct=20,
        )
    )
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True,
                             core=True))
    aud = models.AudienceSegment(id=1, slug="budget", name="Budget")
    mom = models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative")
    session.add_all([aud, mom])
    # Window is far in the future; the FakeBackend returns a 2026-07-29 date, which is
    # OUTSIDE this window, so the fare is in no template's scope -> no match -> no candidate.
    session.add(
        models.DealTemplate(
            id=1,
            slug="future",
            name="Future",
            enabled=True,
            audience_segment_id=1,
            travel_moment_id=1,
            trip_type="oneway",
            date_window_type="relative",
            rel_offset_start_days=200,
            rel_offset_end_days=260,
            included_zones=["MED"],
            max_stops=1,
        )
    )
    session.commit()

    # The window (200-260d from 2026-06-02) means resolve() yields a spec, but the calendar
    # date 2026-07-29 (58d ahead) falls outside it, so _fare_in_template_scope rejects it
    # for every template -> no matches -> no candidate persisted.
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    assert summary.candidates_found == 0
    assert session.query(models.Candidate).count() == 0


def test_run_scan_persists_per_scorer_rows(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="test")

    # The weighted scorer fired -> its score persisted to candidate_scores...
    weighted_rows = session.query(models.CandidateScore).filter_by(scorer="weighted").all()
    assert weighted_rows, "expected weighted scores persisted to candidate_scores"
    # ...and the headline match carries the scorer + normalized score.
    match = session.query(models.CandidateTemplateMatch).one()
    assert match.primary_scorer == "weighted"
    assert match.score_0_100 == round(match.match_score * 100)
    assert match.quality_tier in (None, "great", "rare")


def _seed_many_routes(session, n=6):
    """Zone + template as in _seed, but n routes so health bars have a sample."""
    session.add(
        models.Zone(
            zone="MED",
            haul_type="short",
            threshold_price_eur=60,
            min_abs_savings_eur=20,
            min_discount_pct=20,
        )
    )
    dests = ["BCN", "AGP", "PMI", "LIS", "FAO", "ATH"][:n]
    for i, d in enumerate(dests, start=1):
        session.add(models.Route(id=i, origin="VNO", destination=d, zone="MED", enabled=True,
                                 core=True))
    session.add_all(
        [
            models.AudienceSegment(id=1, slug="budget", name="Budget"),
            models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative"),
        ]
    )
    session.add(
        models.DealTemplate(
            id=1,
            slug="lastminute",
            name="Last-minute",
            enabled=True,
            audience_segment_id=1,
            travel_moment_id=1,
            trip_type="oneway",
            date_window_type="relative",
            rel_offset_start_days=1,
            rel_offset_end_days=60,
            included_zones=["MED"],
            max_stops=1,
        )
    )
    session.commit()


class EmptyBackend(FakeBackend):
    """The gated mode: every search succeeds with zero results."""

    def search_calendar(self, spec):
        return []

    def search_flights(self, *a, **k):
        return []


class HalfEmptyBackend(FakeBackend):
    def search_calendar(self, spec):
        if spec.destination in ("BCN", "AGP", "PMI"):
            return super().search_calendar(spec)
        return []


def test_all_empty_scan_is_degraded(session):
    _seed_many_routes(session)
    adapter = FliAdapter(EmptyBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    run = session.query(models.ScanRun).one()
    assert run.status == "degraded"
    assert run.health["reasons"], "expected reasons explaining the degradation"
    assert run.health["metrics"]["calendar_empty"] == 6
    assert summary.health is not None and summary.health.degraded
    assert session.query(models.Candidate).count() == 0


def test_half_empty_scan_is_degraded_but_keeps_data(session):
    _seed_many_routes(session)
    adapter = FliAdapter(HalfEmptyBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    run = session.query(models.ScanRun).one()
    assert run.status == "degraded"  # 3/6 empty == EMPTY_RATIO_BAR
    assert session.query(models.PriceLog).count() == 9  # 3 data routes x 3 points
    assert session.query(models.Candidate).count() == 3  # degraded keeps its data


def test_healthy_scan_records_health_json(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    run = session.query(models.ScanRun).one()
    assert run.status == "completed"
    assert run.health["reasons"] == []
    assert run.health["metrics"]["calendar_calls"] == 1


def test_expiry_sweep_expires_past_dates(session):
    _seed(session)
    session.add(
        models.Candidate(
            id=50,
            route_id=1,
            origin="VNO",
            destination="BCN",
            zone="MED",
            trip_type="oneway",
            travel_date=date(2026, 5, 1),
            price=30.0,
            deal_group_key="k50",
        )
    )
    common = {
        "candidate_id": 50,
        "deal_template_id": 1,
        "origin": "VNO",
        "destination": "BCN",
        "trip_type": "oneway",
        "price": 30.0,
        "status": "live",
    }
    session.add_all(
        [
            models.PublishedDeal(
                id=11, headline="past valid_until", valid_until=date(2026, 6, 1), **common
            ),
            models.PublishedDeal(
                id=12, headline="past travel", travel_date=date(2026, 5, 1), **common
            ),
            models.PublishedDeal(
                id=13,
                headline="future",
                valid_until=date(2026, 12, 1),
                travel_date=date(2026, 12, 24),
                **common,
            ),
            models.PublishedDeal(id=14, headline="dateless", **common),
        ]
    )
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    statuses = {
        pd.id: pd.status
        for pd in session.query(models.PublishedDeal).filter(models.PublishedDeal.id >= 11)
    }
    assert statuses == {11: "expired", 12: "expired", 13: "live", 14: "live"}


def test_cliff_reason_uses_last_trustworthy_run(session):
    """Collapsed scan after a healthy prior carries the cliff reason; failed runs skipped."""
    _seed_many_routes(session)
    prior = models.ScanRun(scanner_version="t", status="completed", started_at=datetime(2026, 6, 1))
    failed = models.ScanRun(
        scanner_version="t", status="failed", started_at=datetime(2026, 6, 1, 12)
    )
    session.add_all([prior, failed])
    session.flush()
    for i in range(100):
        session.add(
            models.PriceLog(
                run_id=prior.id,
                route_id=1,
                trip_type="oneway",
                travel_date=date(2026, 7, 1),
                price=100.0 + i,
                currency="EUR",
                scanner_version="t",
                scanned_at=datetime(2026, 6, 1),
            )
        )
    session.commit()

    adapter = FliAdapter(EmptyBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    run = session.query(models.ScanRun).order_by(models.ScanRun.id.desc()).first()
    assert run.status == "degraded"
    assert run.health["metrics"]["prior_price_rows"] == 100  # the failed run was skipped
    assert any("cliff" in r for r in run.health["reasons"])


def _seed_two_routes(session):
    """Zone + template scoped to MED, route 1 core, route 2 tail."""
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                            min_abs_savings_eur=20, min_discount_pct=20))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED",
                             enabled=True, core=True))
    session.add(models.Route(id=2, origin="VNO", destination="AGP", zone="MED",
                             enabled=True, core=False))
    session.add_all([models.AudienceSegment(id=1, slug="budget", name="B"),
                     models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative")])
    session.add(models.DealTemplate(
        id=1, slug="lastminute", name="LM", enabled=True, audience_segment_id=1,
        travel_moment_id=1, trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=1, rel_offset_end_days=60, included_zones=["MED"], max_stops=1))
    session.commit()


def test_core_route_scans_every_day_tail_rotates(session):
    _seed_two_routes(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    # Walk to a day whose slot is NOT route 2's (id % 10 == 2) -> tail not due.
    today = date(2026, 6, 2)
    while today.toordinal() % 10 == 2:
        today = today.fromordinal(today.toordinal() + 1)
    run_scan(session, today=today, adapter=adapter, tail_rotation_days=10)
    scanned = {r[0] for r in session.query(models.PriceLog.route_id).distinct()}
    assert scanned == {1}  # core only


def test_tail_route_scans_on_its_slot_day(session):
    _seed_two_routes(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    # Pick a day whose ordinal % 10 == 2 (route 2's slot): walk forward from 2026-06-02.
    today = date(2026, 6, 2)
    while today.toordinal() % 10 != 2:
        today = today.fromordinal(today.toordinal() + 1)
    run_scan(session, today=today, adapter=adapter, tail_rotation_days=10)
    scanned = {r[0] for r in session.query(models.PriceLog.route_id).distinct()}
    assert scanned == {1, 2}  # core + due tail


def test_all_routes_overrides_rotation(session):
    _seed_two_routes(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter,
             tail_rotation_days=10, all_routes=True)
    scanned = {r[0] for r in session.query(models.PriceLog.route_id).distinct()}
    assert scanned == {1, 2}


def test_disabled_core_route_never_scans(session):
    _seed_two_routes(session)
    session.query(models.Route).filter_by(id=1).update({"enabled": False})
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, tail_rotation_days=10)
    scanned = {r[0] for r in session.query(models.PriceLog.route_id).distinct()}
    assert 1 not in scanned


def test_plan_block_in_health_json(session):
    _seed_two_routes(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    # Use a day where the tail route is NOT due, so plan counts are deterministic.
    today = date(2026, 6, 2)
    while today.toordinal() % 10 == 2:
        today = today.fromordinal(today.toordinal() + 1)
    run_scan(session, today=today, adapter=adapter, tail_rotation_days=10)
    run = session.query(models.ScanRun).one()
    assert run.health["plan"] == {"core": 1, "tail": 0, "specs_planned": 1}


class SpreadBackend:
    """5 near-priced cheap dates (<=110% of the 30.0 fare) + 6 expensive ones.

    The 6 expensive dates keep the window median in the expensive cluster (~90 EUR)
    so the 30 EUR flagged fare carries enough discount to pass scoring gates.
    """

    def search_calendar(self, spec):
        d = date(2026, 7, 20)
        cheap = [(d.fromordinal(d.toordinal() + i), None, 30.0 + i * 0.5) for i in range(5)]
        dear = [
            (date(2026, 7, 28), None, 90.0),
            (date(2026, 7, 29), None, 95.0),
            (date(2026, 7, 30), None, 100.0),
            (date(2026, 7, 31), None, 105.0),
            (date(2026, 8, 1), None, 110.0),
            (date(2026, 8, 2), None, 115.0),
        ]
        return cheap + dear

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        # Fare deliberately diverges from calendar price (28.0 vs 30.0) to lock the
        # design: departure_date_count anchors on the CALENDAR point price, not the fare.
        return [{"price": 28.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "self_transfer": False,
                 "mixed_cabin": False, "booking_url": "https://x"}]


def test_gate_passes_when_enough_near_price_dates(session):
    _seed(session)
    session.query(models.DealTemplate).update({"min_departure_dates": 5})
    session.commit()
    adapter = FliAdapter(SpreadBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter)
    # Decile 30.5 flags two calendar points (30.0 and 30.5), each yielding one candidate.
    assert summary.candidates_found == 2
    assert summary.matches_created == 2
    # Calendar-anchor proof: fare is 28.0 but near_dates counts from calendar price 30.0
    # (ceiling 33.0 → 5 qualifying dates), not from fare 28.0 (ceiling 30.8 → 2 dates).
    cand = session.query(models.Candidate).filter_by(price=28.0).first()
    assert cand.departure_date_count == 5


def test_gate_blocks_template_below_minimum(session):
    _seed(session)
    session.query(models.DealTemplate).update({"min_departure_dates": 6})
    session.commit()
    adapter = FliAdapter(SpreadBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter)
    assert summary.matches_created == 0
    assert summary.candidates_found == 0  # no match -> no orphan candidate


def test_null_gate_template_unaffected(session):
    _seed(session)  # min_departure_dates stays NULL
    adapter = FliAdapter(SpreadBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter)
    # Decile 30.5 flags two calendar points (30.0 and 30.5); NULL gate never blocks.
    assert summary.matches_created == 2
