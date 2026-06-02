"""Offline full-pipeline E2E — deterministic, no network (Task 1).

Calls seed_all then run_scan with a window-aware FakeBackend and asserts the
complete pipeline: scan run, price_log, candidates, template matches, content
drafts, curator grouping query, recheck, publish, and idempotency on re-scan.
"""

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.scanning.orchestrator import run_scan
from skrendam.seeds import seed_all
from skrendam.verification import recheck_candidate

# ─── today chosen to be inside summer 06-01..08-31 window (family-school-holiday-sun
#      and plan-ahead-summer both resolve); relative templates always resolve. ────────
TODAY = date(2026, 6, 15)


# ─── FakeBackend ─────────────────────────────────────────────────────────────────────

def _rd(spec):
    """Return date when roundtrip, else None."""
    if spec.trip_type == "roundtrip":
        return spec.window_start + timedelta(days=spec.duration_days)
    return None


class FakeBackend:
    """Returns 3 calendar points rooted at spec.window_start (always inside the
    resolving template's window) plus one cheap detail fare.

    The three points vary travel_date by +0/+1/+2 days so they are distinct rows
    in price_log; having three prices means baseline.decile == the minimum, which
    flags only the EUR 30.0 point, triggering exactly one search_flights call per
    spec (bounded, deterministic).
    """

    def search_calendar(self, spec):
        ws = spec.window_start
        rd0 = _rd(spec)
        rd1 = None if rd0 is None else rd0 + timedelta(days=1)
        rd2 = None if rd0 is None else rd0 + timedelta(days=2)
        return [
            (ws,                     rd0, 30.0),
            (ws + timedelta(days=1), rd1, 210.0),
            (ws + timedelta(days=2), rd2, 215.0),
        ]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{
            "price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
            "legs": [{"airline": {"code": "W6"}, "flight_number": "1"}],
            "self_transfer": False, "mixed_cabin": False,
            "booking_url": "https://x",
        }]


def _make_adapter():
    return FliAdapter(FakeBackend(), pace=lambda: None)


# ─── The single E2E test ─────────────────────────────────────────────────────────────

def test_full_pipeline_offline(session):
    seed_all(session)

    summary = run_scan(session, today=TODAY, adapter=_make_adapter(),
                       scanner_version="e2e-test")

    # ── 1. summary: all 6 templates scanned ──────────────────────────────────────────
    assert summary.templates_scanned == 6

    # ── 2. ScanRun row ───────────────────────────────────────────────────────────────
    run = session.query(models.ScanRun).one()
    assert run.status == "completed"
    assert run.started_at <= run.finished_at
    assert run.api_calls > 0

    # ── 3. price_log rows logged (3 per resolved spec) ───────────────────────────────
    assert session.query(models.PriceLog).count() > 0

    # ── 4. at least one candidate ────────────────────────────────────────────────────
    candidates = session.query(models.Candidate).all()
    assert len(candidates) >= 1

    # ── 5. no orphan candidates (every candidate has ≥1 match) ───────────────────────
    #    Subquery counts matches per candidate; outer filters for zero-match cands.
    match_counts = (
        select(
            models.CandidateTemplateMatch.candidate_id,
            func.count(models.CandidateTemplateMatch.id).label("cnt"),
        )
        .group_by(models.CandidateTemplateMatch.candidate_id)
        .subquery()
    )
    orphans = session.scalars(
        select(models.Candidate).where(
            models.Candidate.id.not_in(select(match_counts.c.candidate_id))
        )
    ).all()
    assert orphans == [], f"orphan candidates (no match row): {[c.id for c in orphans]}"

    # ── 6. content_drafts ≥ candidates (one draft per (candidate, template) match) ───
    draft_count = session.query(models.ContentDraft).count()
    assert draft_count >= len(candidates)

    # ── 7. curator grouping query: templates with ≥1 'new' candidate ─────────────────
    stmt = (
        select(
            models.DealTemplate.id,
            func.count(models.Candidate.id).label("cand_count"),
        )
        .join(
            models.CandidateTemplateMatch,
            models.CandidateTemplateMatch.deal_template_id == models.DealTemplate.id,
        )
        .join(
            models.Candidate,
            models.Candidate.id == models.CandidateTemplateMatch.candidate_id,
        )
        .where(models.Candidate.status == "new")
        .group_by(models.DealTemplate.id)
        .having(func.count(models.Candidate.id) >= 1)
    )
    grouped = session.execute(stmt).all()
    assert len(grouped) >= 1, "curator grouping query found no template with a new candidate"

    # ── 8. recheck: pick first candidate, call recheck_candidate ─────────────────────
    cand = candidates[0]
    recheck_now = datetime(2026, 6, 15, 12, 0, 0)
    check = recheck_candidate(session, cand, _make_adapter(), now=recheck_now)
    assert check.available is True
    assert cand.verified_at == recheck_now
    assert session.query(models.VerificationCheck).filter_by(candidate_id=cand.id).count() >= 1

    # ── 9. publish: simulate curator approval ─────────────────────────────────────────
    first_match = (
        session.query(models.CandidateTemplateMatch)
        .filter_by(candidate_id=cand.id)
        .first()
    )
    assert first_match is not None
    tpl = session.get(models.DealTemplate, first_match.deal_template_id)
    draft = (
        session.query(models.ContentDraft)
        .filter_by(candidate_id=cand.id, deal_template_id=tpl.id)
        .first()
    )
    assert draft is not None

    published = models.PublishedDeal(
        candidate_id=cand.id,
        deal_template_id=tpl.id,
        content_draft_id=draft.id,
        headline=draft.headline or f"{cand.origin}->{cand.destination} EUR{cand.price:.0f}",
        origin=cand.origin,
        destination=cand.destination,
        zone=cand.zone,
        trip_type=cand.trip_type,
        travel_date=cand.travel_date,
        return_date=cand.return_date,
        price=cand.price,
        baseline_price=cand.baseline_price,
        discount_pct=cand.discount_pct,
        status="live",
    )
    session.add(published)
    session.commit()

    saved = session.query(models.PublishedDeal).one()
    assert saved.deal_template_id == tpl.id
    assert saved.candidate_id == cand.id
    assert saved.status == "live"

    # Mark candidate approved (curator action)
    cand.status = "approved"
    session.commit()

    # ── 10. re-scan does not resurrect / duplicate approved candidate ─────────────────
    summary2 = run_scan(session, today=TODAY, adapter=_make_adapter(),
                        scanner_version="e2e-test-rescan")

    # The approved candidate's deal_group_key already exists; upsert_candidate returns
    # (existing, False) so candidates_found is NOT incremented for it.
    # The total candidate count must not grow for the already-approved candidate.
    cand_after = session.get(models.Candidate, cand.id)
    assert cand_after is not None
    assert cand_after.status == "approved", (
        "re-scan changed an approved candidate's status — it must be left alone"
    )

    # No new PublishedDeal should have been created (still exactly 1).
    assert session.query(models.PublishedDeal).count() == 1
