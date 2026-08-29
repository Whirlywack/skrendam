"""Offline full-pipeline E2E — deterministic, no network (Task 1).

Calls seed_all then run_scan with a window-aware FakeBackend and asserts the
complete pipeline: scan run, price_log, candidates, template matches, content
drafts, curator grouping query, recheck, publish, and idempotency on re-scan.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.scanning.orchestrator import run_scan
from skrendam.seeds import seed_all
from skrendam.verification import recheck_candidate

# ─── today chosen to be inside summer 06-01..08-31 window (family-school-holiday-sun
#      and plan-ahead-summer both resolve); relative templates always resolve. ────────
TODAY = date(2026, 6, 15)

# ─── Expected exact pipeline counts for TODAY=2026-06-15 with NewFakeBackend ─────────
# Re-derived 2026-08-29 for the moment-structure audit seed (159 routes, 14
# templates: last-warm-days split Oct/Nov, three fixed-window school-break
# templates, plan-ahead-summer seasonal+60d lead, weekend gate live): the
# templates over due_routes(rotation_days=10) resolve to 151 specs; the fake is
# single-month so Wave-1 month-local scoring is neutral (month == window stats).
#
# 7 calendar points per spec → 151 * 7 = 1057 price_log rows.
# Decile on [30.0,31.0,31.5,32.0,33.0,210.0,215.0] = 30.6 → only 30.0 is flagged
# (single-month fake: month decile == window decile).
# near_dates = prices ≤ 30.0*1.10=33.0 → 5 points → satisfies min_departure_dates=5.
# Weighted fires wherever the EUR30 fare passes a price-cap/psych gate; matches
# per template (a fare can attach to EVERY in-scope template, so the Oct 30 -
# Nov 4 school-break fares also file under the last-warm-days windows):
#   family-school-holiday-sun 30, last-warm-days 22, family-autumn-sun 21,
#   last-warm-days-november 14, vfr-watch 10, family-easter-sun 5,
#   family-feb-sun 3 → 105 matches over 84 distinct candidates.
# last-minute-weekends is now ZERO by design: its flagged point (today+3 =
# Thu Jun 18) fails the FRI/SAT hard gate added 2026-08-29.
# september-sun, christmas-markets, plan-ahead-summer, winter-sun-escape and
# ski-alps stay quiet: discount-only gates (25-30%) vs the fake's 6%
# below-median fare. Outlier scorer quiet too (z=-1.35 at month MAD 1.0).
# Drafts are per match → 105.
E2E_PRICE_LOG_ROWS = 1057
E2E_CANDIDATES = 84
E2E_MATCHES = 105
E2E_DRAFTS = 105


# ─── FakeBackend ─────────────────────────────────────────────────────────────────────


def _rd(spec):
    """Return date when roundtrip, else None."""
    if spec.trip_type == "roundtrip":
        return spec.window_start + timedelta(days=spec.duration_days)
    return None


class FakeBackend:
    """Window-aware calendar fake: 7 points rooted at spec.window_start.

    Prices: 30.0, 31.0, 31.5, 32.0, 33.0 (all ≤ 30.0*1.10=33.0, cheap cluster)
    and 210.0, 215.0 (expensive).  Travel dates are window_start + 0..6 days.

    Baseline decile on 7 prices = 30.6, flagging only the 30.0 point.
    near_dates = 5 (prices ≤ 33.0), satisfying min_departure_dates=5 gates
    so templates gated on that field now match — the key coverage improvement.

    Exactly one search_flights call per spec (one flagged point), keeping the
    test deterministic and bounded.
    """

    def search_calendar(self, spec):
        ws = spec.window_start
        rd0 = _rd(spec)
        cheap_prices = [30.0, 31.0, 31.5, 32.0, 33.0]
        expensive_prices = [210.0, 215.0]
        points = []
        for i, price in enumerate(cheap_prices + expensive_prices):
            rd = None if rd0 is None else rd0 + timedelta(days=i)
            points.append((ws + timedelta(days=i), rd, price))
        return points

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [
            {
                "price": 30.0,
                "currency": "EUR",
                "stops": 0,
                "duration": 215,
                "legs": [{"airline": {"code": "W6"}, "flight_number": "1"}],
                "self_transfer": False,
                "mixed_cabin": False,
                "booking_url": "https://x",
            }
        ]


def _make_adapter():
    return FliAdapter(FakeBackend(), pace=lambda: None)


# ─── The single E2E test ─────────────────────────────────────────────────────────────


def test_full_pipeline_offline(session):
    seed_all(session)

    summary = run_scan(session, today=TODAY, adapter=_make_adapter(), scanner_version="e2e-test")

    # ── 1. summary: all 14 templates scanned ─────────────────────────────────────────
    assert summary.templates_scanned == 14

    # ── 2. ScanRun row ───────────────────────────────────────────────────────────────
    run = session.query(models.ScanRun).one()
    assert run.status == "completed"
    assert run.started_at <= run.finished_at
    assert run.api_calls > 0

    # ── 3. price_log rows logged (7 per resolved spec × 64 specs) ───────────────────
    assert session.query(models.PriceLog).count() == E2E_PRICE_LOG_ROWS

    # ── 4. exact candidate count ──────────────────────────────────────────────────────
    candidates = session.query(models.Candidate).all()
    assert len(candidates) == E2E_CANDIDATES

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

    # ── 6. content_drafts: exactly one per (candidate, template) match ───────────────
    draft_count = session.query(models.ContentDraft).count()
    assert draft_count == E2E_DRAFTS

    # ── 6b. a gated template (min_departure_dates=5) now produces matches ─────────────
    #    vfr-watch carries min_departure_dates=5; with near_dates=5 it passes the gate.
    gated_template_slugs = {
        row[0]
        for row in session.execute(
            select(models.DealTemplate.slug)
            .join(
                models.CandidateTemplateMatch,
                models.CandidateTemplateMatch.deal_template_id == models.DealTemplate.id,
            )
            .where(models.DealTemplate.min_departure_dates == 5)
            .distinct()
        ).all()
    }
    assert "vfr-watch" in gated_template_slugs, (
        f"vfr-watch (min_departure_dates=5) should match but did not; "
        f"gated templates with matches: {gated_template_slugs}"
    )

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
        session.query(models.CandidateTemplateMatch).filter_by(candidate_id=cand.id).first()
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
    run_scan(session, today=TODAY, adapter=_make_adapter(), scanner_version="e2e-test-rescan")

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
