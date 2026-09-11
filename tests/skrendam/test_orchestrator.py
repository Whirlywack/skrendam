from datetime import date, datetime, timedelta

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.scanning.orchestrator import _verify_live_deals, run_scan


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
    session.add(
        models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True, core=True)
    )
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
        # The leg carries a flight number so a published deal's itinerary_snapshot
        # can name the exact itinerary (verify_deal matches on flight numbers).
        return [
            {
                "price": 30.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}, "flight_number": "W6 100"}],
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
    session.add(
        models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True, core=True)
    )
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
        session.add(
            models.Route(id=i, origin="VNO", destination=d, zone="MED", enabled=True, core=True)
        )
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
            # Deal 13 is live with a future date, so the verification step prices
            # it: the snapshot names FakeBackend's itinerary and the EUR30 answer
            # equals the published price, so the sweep matrix is unchanged.
            itinerary_snapshot=SNAPSHOT,
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
    session.add(
        models.Zone(
            zone="MED",
            haul_type="short",
            threshold_price_eur=60,
            min_abs_savings_eur=20,
            min_discount_pct=20,
        )
    )
    session.add(
        models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True, core=True)
    )
    session.add(
        models.Route(id=2, origin="VNO", destination="AGP", zone="MED", enabled=True, core=False)
    )
    session.add_all(
        [
            models.AudienceSegment(id=1, slug="budget", name="B"),
            models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative"),
        ]
    )
    session.add(
        models.DealTemplate(
            id=1,
            slug="lastminute",
            name="LM",
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
    run_scan(
        session, today=date(2026, 6, 2), adapter=adapter, tail_rotation_days=10, all_routes=True
    )
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
        return [
            {
                "price": 28.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}}],
                "self_transfer": False,
                "mixed_cabin": False,
                "booking_url": "https://x",
            }
        ]


def test_gate_passes_when_enough_near_price_dates(session):
    _seed(session)
    session.query(models.DealTemplate).update({"min_departure_dates": 5})
    session.commit()
    adapter = FliAdapter(SpreadBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter)
    # Month-local decile (Wave 1): July's 9 points give decile 30.4 -> only the
    # 30.0 point is flagged; August's 2-point month falls back to the window
    # decile (30.5) and its 110/115 fares stay unflagged.
    assert summary.candidates_found == 1
    assert summary.matches_created == 1
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
    # Month-local decile flags one point (July decile 30.4); NULL gate never blocks.
    assert summary.matches_created == 1


def test_scan_findings_survive_a_sweep_crash(session, monkeypatch):
    """The commit before the expiry sweep bounds a late DB failure to the sweep.

    2026-08-24 regression: Neon killed the idle connection during the search
    phase; the first statement of the sweep then raised OperationalError and the
    WHOLE 15-minute run rolled back. Findings must already be committed by then.
    """
    import pytest
    from sqlalchemy.exc import OperationalError

    from skrendam.scanning import orchestrator

    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)

    def dead_connection(*a, **k):
        raise OperationalError("SELECT 1", {}, Exception("SSL connection has been closed"))

    monkeypatch.setattr(orchestrator, "_expire_stale", dead_connection)
    with pytest.raises(OperationalError):
        run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="test")
    session.rollback()

    # The scan's findings persisted; only the never-finalized run row marks the crash.
    assert session.query(models.Candidate).count() == 1
    assert session.query(models.PriceLog).count() == 3
    run = session.query(models.ScanRun).one()
    assert run.status == "running" and run.finished_at is None  # watchdog's staleness signal


def test_run_scan_persists_score_v2_archetype_and_signals(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    m = session.query(models.CandidateTemplateMatch).first()
    assert m is not None
    assert m.score_v2 is not None and 0 <= m.score_v2 <= 100
    assert m.archetype in (None, "date", "rare", "destination")
    assert set(m.demand_signals) >= {
        "commodity_share",
        "is_commodity",
        "date_fit",
        "demand_weight",
        "window_slug",
        "window_typical",
        "saving_pp",
        "saving_family",
        "archetypes",
    }
    assert m.demand_signals["commodity_share"] is None  # no history yet -> unknown, not commodity


def test_family_draft_body_is_persisted_from_demand_signals(session):
    """Task 3 (WP3): the draft body is the rules-written LT why + catches.

    A families audience makes assess() emit saving_family, which appends the
    x4 total to the why line; the EUR30 fare against a EUR90 month median is
    a deep enough drop for the "vietoj įprastų" clause.
    """
    _seed(session)
    session.query(models.AudienceSegment).filter_by(id=1).update({"slug": "families"})
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    draft = session.query(models.ContentDraft).one()
    assert isinstance(draft.body, str) and draft.body
    assert draft.body.startswith("€30 vietoj įprastų €")
    assert "Šeimai iš keturių: €120" in draft.body
    # direct, VNO, no leg times, BCN has no climate.json row -> no catches
    assert "\n" not in draft.body


class TierCBackend(FakeBackend):
    """A strong-but-not-rare fare on a spread calendar.

    Prices 55..145 (median 100, MAD 30) keep the modified z at ~-1.0, so the
    outlier/error-fare scorers stay quiet and the 45% discount stays under
    demand.RARE_DISCOUNT_PCT: the headline is a plain weighted 0.95.
    """

    PRICES = [55.0, 70.0, 85.0, 100.0, 115.0, 130.0, 145.0]

    def search_calendar(self, spec):
        return [(date(2026, 7, 20 + i), None, p) for i, p in enumerate(self.PRICES)]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        fares = super().search_flights(origin, destination, travel_date, return_date, cabin)
        fares[0]["price"] = 55.0
        return fares


def test_quality_tier_follows_score_v2_not_the_headline_score(session):
    """D6: a headline-great fare to a low-demand destination is NOT tiered great.

    XXX is in no demand_tiers.json band -> tier C -> weight 0.70, which drags a
    95 headline down to 66 on score_v2. score_0_100 keeps the honest headline
    number; quality_tier must follow score_v2 and stay NULL.
    """
    _seed(session)
    session.query(models.Route).filter_by(id=1).update({"destination": "XXX"})
    session.commit()
    adapter = FliAdapter(TierCBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    m = session.query(models.CandidateTemplateMatch).one()
    assert m.score_0_100 >= 88
    assert m.demand_signals["demand_tier"] == "C" and m.demand_signals["demand_weight"] == 0.7
    assert m.score_v2 < 88
    assert m.quality_tier is None


class EarlyBirdBackend(FakeBackend):
    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        fares = super().search_flights(origin, destination, travel_date, return_date, cabin)
        for f in fares:
            f["legs"] = [
                {
                    "airline": {"code": "W6"},
                    "departure_time": f"{travel_date}T05:50:00",
                    "arrival_time": f"{travel_date}T08:30:00",
                }
            ]
        return fares


def test_family_friendly_template_rejects_0550_departure(session):
    """The gate runs BEFORE scoring, so no scorer can smuggle the fare through.

    ErrorFareScorer is deliberately lenient on itinerary (an error fare is worth
    surfacing even if ugly) and never calls itinerary_ok. The route therefore
    carries >= ErrorFareScorer.MIN_HISTORY prior points whose floor (EUR100) the
    EUR30 fare undercuts by 70%: error_fare WOULD fire if the orchestrator let
    the fare reach the scorers at all.
    """
    _seed(session)
    tpl = session.get(models.DealTemplate, 1)
    tpl.family_friendly_times_only = True
    prior = models.ScanRun(scanner_version="t", status="completed", started_at=datetime(2026, 6, 1))
    session.add(prior)
    session.flush()
    for i in range(8):
        session.add(
            models.PriceLog(
                run_id=prior.id,
                route_id=1,
                trip_type="oneway",
                travel_date=date(2026, 7, 29),
                price=100.0 + i,
                currency="EUR",
                scanner_version="t",
                scanned_at=datetime(2026, 6, 1),
            )
        )
    session.commit()
    adapter = FliAdapter(EarlyBirdBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    assert summary.matches_created == 0
    assert session.query(models.CandidateScore).filter_by(scorer="error_fare").count() == 0


class RoundTripBackend(FakeBackend):
    """FakeBackend with real return dates, so a roundtrip template resolves fares."""

    def search_calendar(self, spec):
        return [
            (d, d + timedelta(days=spec.duration_days or 0), price)
            for d, _, price in super().search_calendar(spec)
        ]


def test_scoring_and_demand_share_one_duration_partitioned_history(session, monkeypatch):
    """One history fetch per fare, partitioned by trip duration (review A3).

    Scoring used the unpartitioned series while the demand layer fetched a second,
    duration-filtered one — two different notions of "this route's history" for the
    same fare, and a second prefetch query per fare. Now there is exactly one.
    """
    from skrendam.scanning import orchestrator
    from skrendam.scanning.history import DbPriceHistory

    _seed(session)
    session.query(models.DealTemplate).update({"trip_type": "roundtrip", "trip_len_min_days": 5})
    session.commit()
    calls = []

    class SpyHistory(DbPriceHistory):
        def for_route(self, route_id, trip_type, duration_days=None):
            calls.append((route_id, trip_type, duration_days))
            return super().for_route(route_id, trip_type, duration_days)

    monkeypatch.setattr(orchestrator, "DbPriceHistory", SpyHistory)
    adapter = FliAdapter(RoundTripBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    assert calls == [(1, "roundtrip", 5)]


def test_purge_sweep_deletes_long_unsubscribed(session):
    """Unsubscribed rows are erased 30 days later; active subscribers stay."""
    _seed(session)
    now = datetime(2026, 6, 2)
    session.add_all(
        [
            models.Subscriber(id=1, email="gone@yip.lt", unsubscribed_at=now - timedelta(days=31)),
            models.Subscriber(
                id=2, email="recent@yip.lt", unsubscribed_at=now - timedelta(days=29)
            ),
            models.Subscriber(id=3, email="active@yip.lt", unsubscribed_at=None),
        ]
    )
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t", now=now)
    assert {s.id for s in session.query(models.Subscriber)} == {2, 3}


def test_date_sweep_stamps_expired_at(session):
    """The date sweep records WHEN a deal expired (the injected `now`), not just that it did."""
    _seed(session)
    session.add(
        models.Candidate(
            id=51,
            route_id=1,
            origin="VNO",
            destination="BCN",
            zone="MED",
            trip_type="oneway",
            travel_date=date(2026, 12, 1),
            price=30.0,
            deal_group_key="k51",
        )
    )
    session.add(
        models.PublishedDeal(
            id=21,
            candidate_id=51,
            deal_template_id=1,
            headline="past valid_until",
            origin="VNO",
            destination="BCN",
            trip_type="oneway",
            price=30.0,
            status="live",
            valid_until=date(2026, 6, 1),
        )
    )
    session.commit()
    now = datetime(2026, 6, 2, 6, 30)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t", now=now)
    pd = session.get(models.PublishedDeal, 21)
    assert pd.status == "expired"
    assert pd.expired_at == now


def test_orphaned_running_runs_are_failed_at_scan_start(session):
    """Runs still 'running' 6h+ after start are failed; younger and finished rows stay.

    An interrupted run (laptop slept, process died) never finishes on its own, and
    the desk was reading it as an in-progress scan for days.
    """
    _seed(session)
    now = datetime(2026, 6, 2, 6, 0)
    session.add_all(
        [
            models.ScanRun(
                id=90, scanner_version="t", status="running", started_at=now - timedelta(hours=7)
            ),
            models.ScanRun(
                id=91, scanner_version="t", status="running", started_at=now - timedelta(hours=1)
            ),
            models.ScanRun(
                id=92,
                scanner_version="t",
                status="completed",
                started_at=now - timedelta(days=1),
                finished_at=now - timedelta(days=1),
            ),
        ]
    )
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t", now=now)

    orphan = session.get(models.ScanRun, 90)
    assert orphan.status == "failed"
    assert orphan.finished_at == now
    assert orphan.health == {"reasons": ["orphaned: never finished"]}
    assert session.get(models.ScanRun, 91).status == "running"
    assert session.get(models.ScanRun, 92).status == "completed"


# --- live-deal verification step (WP9) ---------------------------------------------

SNAPSHOT = {"price": 30.0, "legs": [{"airline": {"code": "W6"}, "flight_number": "W6100"}]}
NOW = datetime(2026, 6, 2, 6, 30)
TODAY = NOW.date()


def _fare(price, flight_number="W6 100"):
    return {
        "price": price,
        "currency": "EUR",
        "stops": 0,
        "duration": 215,
        "legs": [{"airline": {"code": "W6"}, "flight_number": flight_number}],
        "self_transfer": False,
        "mixed_cabin": False,
        "booking_url": "https://x",
    }


class VerifyBackend(FakeBackend):
    """FakeBackend whose flights answers are scripted per travel date.

    ``by_date[travel_date]`` is the fare list for that date ([] = empty answer);
    unscripted dates fall back to FakeBackend's EUR30 fare. ``flights_calls`` records
    every flights request the adapter actually forwarded (cache misses).
    """

    def __init__(self, by_date=None):
        """Script ``by_date`` ({travel_date: fares | [] | ScanError}); start with no calls."""
        self.by_date = by_date or {}
        self.flights_calls = []

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        self.flights_calls.append((origin, destination, travel_date, return_date, cabin))
        if travel_date in self.by_date:
            answer = self.by_date[travel_date]
            if isinstance(answer, Exception):
                raise answer
            return list(answer)
        return super().search_flights(origin, destination, travel_date, return_date, cabin)


def _seed_live_deal(
    session,
    deal_id,
    *,
    travel_date,
    price=30.0,
    baseline=90.0,
    published_at=NOW - timedelta(days=1),
    verified_at=None,
    status="live",
    missed_checks=0,
    snapshot=SNAPSHOT,
):
    """Seed a live published deal on route 1 with its candidate (snapshot + cabin)."""
    session.add(
        models.Candidate(
            id=100 + deal_id,
            route_id=1,
            origin="VNO",
            destination="BCN",
            zone="MED",
            trip_type="oneway",
            # candidates.travel_date is NOT NULL; only the deal may be dateless
            travel_date=travel_date or date(2026, 8, 1),
            price=price,
            baseline_price=baseline,
            deal_group_key=f"k{deal_id}",
            itinerary_snapshot=snapshot,
            search_params={"cabin": "ECONOMY"},
            status="approved",
        )
    )
    deal = models.PublishedDeal(
        id=deal_id,
        candidate_id=100 + deal_id,
        deal_template_id=1,
        headline=f"deal {deal_id}",
        origin="VNO",
        destination="BCN",
        zone="MED",
        trip_type="oneway",
        travel_date=travel_date,
        price=price,
        baseline_price=baseline,
        status=status,
        published_at=published_at,
        verified_at=verified_at,
        missed_checks=missed_checks,
    )
    session.add(deal)
    session.commit()
    return deal


def _checks(session, deal_id):
    return (
        session.query(models.DealPriceCheck)
        .filter_by(deal_id=deal_id)
        .order_by(models.DealPriceCheck.id)
        .all()
    )


def _run(session, backend, *, today=TODAY, now=NOW):
    adapter = FliAdapter(backend, pace=lambda: None)
    return run_scan(session, today=today, adapter=adapter, scanner_version="t", now=now)


def test_verify_live_deal_at_published_price_stays_live_and_writes_check(session):
    """An exact answer at the published price: live, current_price stamped, one row."""
    _seed(session)
    d = date(2026, 8, 10)  # not a calendar date -> no free check -> exact flights call
    _seed_live_deal(session, 31, travel_date=d)
    backend = VerifyBackend({d: [_fare(30.0)]})
    summary = _run(session, backend)

    deal = session.get(models.PublishedDeal, 31)
    assert deal.status == "live"
    assert deal.current_price == 30.0 and deal.current_price_at == NOW
    assert deal.window_min_price == 30.0 and deal.window_min_date == d
    assert deal.verified_at == NOW and deal.missed_checks == 0
    assert deal.unverified_since is None and deal.expired_at is None
    (row,) = _checks(session, 31)
    run = session.query(models.ScanRun).one()
    assert (row.source, row.available, row.price, row.window_min_price, row.run_id) == (
        "flights",
        True,
        30.0,
        30.0,
        run.id,
    )
    assert row.checked_at == NOW
    assert summary.deals_verified == 1 and summary.deals_changed == 0
    assert summary.deals_expired == 0 and summary.verify_calls == 1
    assert run.health["metrics"]["deals_verified"] == 1
    assert run.health["metrics"]["verify_calls"] == 1
    # 1 calendar + 1 discovery flights + 1 verification flights; nothing double counted.
    assert run.api_calls == 3
    assert [c[2] for c in backend.flights_calls] == [date(2026, 7, 29), d]


def test_verify_price_up_20pct_marks_deal_changed_with_current_price(session):
    """EUR36 against EUR30 published is beyond the 10% tolerance but still a deal."""
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 32, travel_date=d)
    summary = _run(session, VerifyBackend({d: [_fare(36.0)]}))

    deal = session.get(models.PublishedDeal, 32)
    assert deal.status == "changed"
    assert deal.price == 30.0  # the published price never moves
    assert deal.current_price == 36.0 and deal.verified_at == NOW
    assert deal.expired_at is None
    assert summary.deals_changed == 1 and summary.deals_expired == 0
    assert session.query(models.ScanRun).one().health["metrics"]["deals_changed"] == 1


def test_verify_real_price_failing_the_gate_expires_the_deal(session):
    """A real EUR100 (above the zone ceiling, no discount vs EUR90) is no longer a deal."""
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 33, travel_date=d)
    summary = _run(session, VerifyBackend({d: [_fare(100.0)]}))

    deal = session.get(models.PublishedDeal, 33)
    assert deal.status == "expired"
    assert deal.expired_at == NOW  # the run's wall clock, not midnight
    assert deal.current_price == 100.0
    assert summary.deals_expired == 1 and summary.deals_changed == 0


def test_verify_one_empty_answer_only_counts_a_miss(session):
    """Empty answer on a healthy run: status untouched, missed=1, unverified_since set."""
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 34, travel_date=d)
    summary = _run(session, VerifyBackend({d: []}))

    deal = session.get(models.PublishedDeal, 34)
    assert deal.status == "live"
    assert deal.missed_checks == 1
    assert deal.unverified_since == NOW
    assert deal.verified_at is None and deal.current_price is None
    assert deal.expired_at is None
    (row,) = _checks(session, 34)
    assert row.available is False and row.price is None and row.source == "flights"
    assert summary.deals_verified == 1 and summary.deals_expired == 0


def test_verify_two_empty_answers_across_two_runs_expire_missing_2_days(session):
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 35, travel_date=d)
    _run(session, VerifyBackend({d: []}))
    deal = session.get(models.PublishedDeal, 35)
    assert deal.status == "live" and deal.missed_checks == 1
    first_unverified = deal.unverified_since

    day2 = NOW + timedelta(days=1)
    _run(session, VerifyBackend({d: []}), today=day2.date(), now=day2)
    deal = session.get(models.PublishedDeal, 35)
    assert deal.status == "expired"
    assert deal.missed_checks == 2
    assert deal.expired_at == day2
    assert deal.unverified_since == first_unverified  # first empty stamp kept
    assert len(_checks(session, 35)) == 2
    runs = session.query(models.ScanRun).order_by(models.ScanRun.id).all()
    assert runs[-1].health["metrics"]["deals_expired"] == 1


def test_verify_skips_deals_already_checked_today(session):
    """A second run on the same day (never intended, but possible) spends nothing."""
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 36, travel_date=d)
    _run(session, VerifyBackend({d: []}))
    later = NOW + timedelta(hours=2)
    backend = VerifyBackend({d: []})
    summary = _run(session, backend, now=later)

    deal = session.get(models.PublishedDeal, 36)
    assert deal.missed_checks == 1  # not 2: the day's answer already counted
    assert len(_checks(session, 36)) == 1
    assert summary.deals_verified == 0 and summary.verify_calls == 0
    assert d not in [c[2] for c in backend.flights_calls]


def test_verify_degraded_run_makes_no_calls_and_changes_nothing(session):
    """A gated pipe (all calendars empty) must not touch live deals at all."""
    _seed_many_routes(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 37, travel_date=d)
    _seed_live_deal(session, 38, travel_date=date(2026, 8, 11), published_at=NOW)

    class GatedBackend(EmptyBackend):
        def __init__(self):
            self.flights_calls = []

        def search_flights(self, origin, destination, travel_date, *a, **k):
            self.flights_calls.append(travel_date)
            return []

    backend = GatedBackend()
    summary = _run(session, backend)

    run = session.query(models.ScanRun).one()
    assert run.status == "degraded"
    assert backend.flights_calls == []
    assert session.query(models.DealPriceCheck).count() == 0
    for deal_id in (37, 38):
        deal = session.get(models.PublishedDeal, deal_id)
        assert deal.status == "live" and deal.missed_checks == 0
        assert deal.unverified_since is None and deal.verified_at is None
    assert summary.deals_verified == 0 and summary.verify_calls == 0
    assert run.health["metrics"]["deals_verified"] == 0


def test_verify_scan_error_is_no_evidence_but_spends_the_call(session):
    _seed(session)
    d = date(2026, 8, 10)
    _seed_live_deal(session, 39, travel_date=d)
    summary = _run(session, VerifyBackend({d: ScanError("boom")}))

    deal = session.get(models.PublishedDeal, 39)
    assert deal.status == "live" and deal.missed_checks == 0
    assert deal.unverified_since is None and _checks(session, 39) == []
    assert summary.verify_calls == 1 and summary.errors == 1
    assert session.query(models.ScanRun).one().status == "completed"


def _verify_directly(session, backend, *, cap):
    """Call the step itself (the cap is its keyword; run_scan uses the module default)."""
    run = models.ScanRun(scanner_version="t", status="running", started_at=NOW)
    session.add(run)
    session.flush()
    adapter = FliAdapter(backend, pace=lambda: None)
    stats = _verify_live_deals(
        session, adapter, today=TODAY, now=NOW, run=run, run_healthy=True, cap=cap
    )
    session.commit()
    return stats


def test_verify_cap_checks_public_deals_first(session):
    """3 deals, cap 2: the two newest (the site's free window) are checked, the oldest waits."""
    _seed(session)
    dates = {}
    for i, deal_id in enumerate((41, 42, 43)):
        dates[deal_id] = date(2026, 8, 10 + i)
        # 43 is newest, 41 oldest -> free-window order 43, 42, 41
        _seed_live_deal(
            session, deal_id, travel_date=dates[deal_id], published_at=NOW - timedelta(days=3 - i)
        )
    backend = VerifyBackend()
    stats = _verify_directly(session, backend, cap=2)

    assert stats.verify_calls == 2 and stats.deals_verified == 2
    assert [c[2] for c in backend.flights_calls] == [dates[43], dates[42]]
    assert session.get(models.PublishedDeal, 43).verified_at == NOW
    assert session.get(models.PublishedDeal, 42).verified_at == NOW
    unchecked = session.get(models.PublishedDeal, 41)
    assert unchecked.verified_at is None and unchecked.status == "live"
    assert _checks(session, 41) == []


def test_verify_priority_public_then_mailed_then_newest(session):
    """Beyond the free window a deal mailed in the last 48 h outranks a newer unmailed one."""
    _seed(session)
    # published_at newest first: 51 > 52 > 53 > 54 > 55; free window = 51, 52, 53.
    dates = {}
    for i, deal_id in enumerate((51, 52, 53, 54, 55)):
        dates[deal_id] = date(2026, 8, 10 + i)
        _seed_live_deal(
            session, deal_id, travel_date=dates[deal_id], published_at=NOW - timedelta(days=1 + i)
        )
    session.add(
        models.Issue(
            kind="paid_digest",
            sent_at=NOW - timedelta(hours=20),
            deal_ids=[55],
            expired_deal_ids=[],
        )
    )
    session.add(  # too old to count as "mailed recently"
        models.Issue(
            kind="paid_digest",
            sent_at=NOW - timedelta(hours=60),
            deal_ids=[54],
            expired_deal_ids=[],
        )
    )
    session.commit()
    backend = VerifyBackend()
    stats = _verify_directly(session, backend, cap=4)

    assert stats.verify_calls == 4
    assert [c[2] for c in backend.flights_calls] == [dates[51], dates[52], dates[53], dates[55]]
    assert _checks(session, 54) == []


def test_verify_calendar_hit_is_a_free_check(session):
    """A deal whose date pair is in today's price_log is verified from the calendar, 0 calls."""
    _seed(session)
    # Three newer deals fill the free window (each costs one exact call); the fourth,
    # older deal sits on the calendar's 2026-07-30 / EUR90 point and was verified
    # yesterday, so no exact check is due for it.
    for i, deal_id in enumerate((61, 62, 63)):
        _seed_live_deal(
            session,
            deal_id,
            travel_date=date(2026, 8, 10 + i),
            published_at=NOW - timedelta(days=1 + i),
        )
    _seed_live_deal(
        session,
        64,
        travel_date=date(2026, 7, 30),
        price=90.0,
        baseline=200.0,
        published_at=NOW - timedelta(days=10),
        verified_at=NOW - timedelta(days=1),
    )
    backend = VerifyBackend()
    summary = _run(session, backend)

    deal = session.get(models.PublishedDeal, 64)
    assert deal.status == "live"
    assert deal.current_price == 90.0 and deal.window_min_price == 90.0
    assert deal.window_min_date == date(2026, 7, 30)
    assert deal.verified_at == NOW
    (row,) = _checks(session, 64)
    assert row.source == "calendar" and row.available is True and row.price == 90.0
    assert date(2026, 7, 30) not in [c[2] for c in backend.flights_calls]
    assert summary.deals_verified == 4 and summary.verify_calls == 3


def test_verify_calendar_price_beyond_tolerance_triggers_exact_check(session):
    """Calendar says EUR90 for a EUR60 deal: record the free check, then spend one exact call."""
    _seed(session)
    for i, deal_id in enumerate((71, 72, 73)):
        _seed_live_deal(
            session,
            deal_id,
            travel_date=date(2026, 8, 10 + i),
            published_at=NOW - timedelta(days=1 + i),
        )
    _seed_live_deal(
        session,
        74,
        travel_date=date(2026, 7, 30),
        price=60.0,
        baseline=200.0,
        published_at=NOW - timedelta(days=10),
        verified_at=NOW - timedelta(days=1),
    )
    backend = VerifyBackend({date(2026, 7, 30): [_fare(66.0)]})
    _run(session, backend)

    rows = _checks(session, 74)
    assert [r.source for r in rows] == ["calendar", "flights"]
    deal = session.get(models.PublishedDeal, 74)
    # The calendar's EUR90 flipped it to changed; the exact itinerary at EUR66 is
    # within tolerance, so the deal ends the run live at its true current price.
    assert deal.status == "live" and deal.current_price == 66.0
    assert date(2026, 7, 30) in [c[2] for c in backend.flights_calls]


def test_verify_stale_verified_at_forces_an_exact_check_despite_calendar_hit(session):
    _seed(session)
    for i, deal_id in enumerate((81, 82, 83)):
        _seed_live_deal(
            session,
            deal_id,
            travel_date=date(2026, 8, 10 + i),
            published_at=NOW - timedelta(days=1 + i),
        )
    _seed_live_deal(
        session,
        84,
        travel_date=date(2026, 7, 30),
        price=90.0,
        baseline=200.0,
        published_at=NOW - timedelta(days=10),
        verified_at=NOW - timedelta(days=4),  # older than EXACT_CHECK_MAX_AGE_DAYS
    )
    backend = VerifyBackend({date(2026, 7, 30): [_fare(90.0)]})
    _run(session, backend)
    assert [r.source for r in _checks(session, 84)] == ["calendar", "flights"]


def test_verify_skips_dateless_deals(session):
    """A deal without a travel date is curator-managed; nothing to price."""
    _seed(session)
    _seed_live_deal(session, 91, travel_date=None)
    backend = VerifyBackend()
    summary = _run(session, backend)
    assert _checks(session, 91) == []
    assert summary.deals_verified == 0 and summary.verify_calls == 0
    assert session.get(models.PublishedDeal, 91).status == "live"
