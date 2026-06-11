from datetime import date

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.scanning.orchestrator import run_scan


def _seed(session):
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                            min_abs_savings_eur=20, min_discount_pct=20))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True))
    aud = models.AudienceSegment(id=1, slug="budget", name="Budget")
    mom = models.TravelMoment(id=1, slug="lm", name="Last minute", moment_type="relative")
    session.add_all([aud, mom])
    session.add(models.DealTemplate(
        id=1, slug="lastminute", name="Last-minute", enabled=True, audience_segment_id=1,
        travel_moment_id=1, trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=1, rel_offset_end_days=60, included_zones=["MED"],
        max_stops=1, suggested_headline_template="{origin}->{destination} EUR{price}"))
    session.commit()


class FakeBackend:
    def search_calendar(self, spec):
        return [(date(2026, 7, 29), None, 30.0), (date(2026, 7, 30), None, 90.0),
                (date(2026, 7, 31), None, 95.0)]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "self_transfer": False,
                 "mixed_cabin": False, "booking_url": "https://x"}]


def test_run_scan_produces_candidate_match_and_draft(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter,
                       scanner_version="test")

    assert summary.candidates_found == 1
    assert summary.matches_created == 1
    cand = session.query(models.Candidate).one()
    assert cand.origin == "VNO" and cand.price == 30.0 and cand.status == "new"
    assert session.query(models.CandidateTemplateMatch).count() == 1
    assert session.query(models.ContentDraft).count() == 1
    run = session.query(models.ScanRun).one()
    assert run.status == "completed" and run.templates_scanned == 1
    # Only the anomalous cheap date (EUR30) triggered a tier-2 detail fetch, not all 3.
    assert session.query(models.PriceLog).count() == 3   # all calendar points logged
    # started_at must be set at the same time as finished_at (same clock source).
    assert run.started_at <= run.finished_at


def test_match_less_fare_creates_no_candidate(session):
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                            min_abs_savings_eur=20, min_discount_pct=20))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True))
    aud = models.AudienceSegment(id=1, slug="budget", name="Budget")
    mom = models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative")
    session.add_all([aud, mom])
    # Window is far in the future; the FakeBackend returns a 2026-07-29 date, which is
    # OUTSIDE this window, so the fare is in no template's scope -> no match -> no candidate.
    session.add(models.DealTemplate(
        id=1, slug="future", name="Future", enabled=True, audience_segment_id=1,
        travel_moment_id=1, trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=200, rel_offset_end_days=260, included_zones=["MED"], max_stops=1))
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
