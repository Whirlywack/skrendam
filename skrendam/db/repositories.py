"""Persistence helpers. Upserts via select-then-write so they run on SQLite + Postgres."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models


def upsert_candidate(session: Session, deal_group_key: str, fields: dict,
                     now: datetime) -> tuple[models.Candidate, bool]:
    """Return (candidate, created) where created=True when a new row was inserted."""
    existing = session.scalar(
        select(models.Candidate).where(models.Candidate.deal_group_key == deal_group_key))
    if existing is None:
        cand = models.Candidate(deal_group_key=deal_group_key, first_seen_at=now,
                                last_seen_at=now, status="new", **fields)
        session.add(cand)
        session.flush()
        return cand, True
    # Re-find: refresh price/last_seen only; never touch a curator decision.
    existing.price = fields["price"]
    existing.last_seen_at = now
    if existing.status not in ("approved", "edited", "rejected"):
        existing.baseline_price = fields.get("baseline_price", existing.baseline_price)
        existing.discount_pct = fields.get("discount_pct", existing.discount_pct)
        existing.itinerary_snapshot = fields.get("itinerary_snapshot", existing.itinerary_snapshot)
        existing.expires_at = fields.get("expires_at", existing.expires_at)
        existing.departure_date_count = fields.get(
            "departure_date_count", existing.departure_date_count
        )
    session.flush()
    return existing, False


def upsert_match(session: Session, candidate_id: int, template_id: int,
                 match_score: float, reason_text: str, gate_results: dict,
                 score_0_100: int | None = None, quality_tier: str | None = None,
                 primary_scorer: str | None = None) -> tuple[models.CandidateTemplateMatch, bool]:
    """Return (match, created).

    The headline fields (score_0_100/quality_tier/primary_scorer) are written on
    BOTH insert and update; the orchestrator always supplies them. The None
    defaults exist only so the legacy 3-arg signature still type-checks — a legacy
    update would null these columns, so don't rely on that path to preserve them.
    """
    existing = session.scalar(
        select(models.CandidateTemplateMatch).where(
            models.CandidateTemplateMatch.candidate_id == candidate_id,
            models.CandidateTemplateMatch.deal_template_id == template_id))
    if existing is None:
        m = models.CandidateTemplateMatch(
            candidate_id=candidate_id, deal_template_id=template_id, match_score=match_score,
            reason_text=reason_text, gate_results=gate_results, score_0_100=score_0_100,
            quality_tier=quality_tier, primary_scorer=primary_scorer)
        session.add(m)
        session.flush()
        return m, True
    existing.match_score = match_score
    existing.reason_text = reason_text
    existing.gate_results = gate_results
    existing.score_0_100 = score_0_100
    existing.quality_tier = quality_tier
    existing.primary_scorer = primary_scorer
    session.flush()
    return existing, False


def upsert_score(session: Session, candidate_id: int, template_id: int,
                 score) -> tuple[models.CandidateScore, bool]:
    """Insert or update the (candidate, template, scorer) score row.

    `score` is a skrendam.scanning.scoring.base.Score (duck-typed here to avoid a
    scanning->db import cycle)."""
    existing = session.scalar(
        select(models.CandidateScore).where(
            models.CandidateScore.candidate_id == candidate_id,
            models.CandidateScore.deal_template_id == template_id,
            models.CandidateScore.scorer == score.scorer))
    if existing is None:
        row = models.CandidateScore(
            candidate_id=candidate_id, deal_template_id=template_id, scorer=score.scorer,
            value=score.value, score_0_100=score.score_0_100, quality_tier=score.quality_tier,
            reason_text=score.reason_text, signals=score.signals)
        session.add(row)
        session.flush()
        return row, True
    existing.value = score.value
    existing.score_0_100 = score.score_0_100
    existing.quality_tier = score.quality_tier
    existing.reason_text = score.reason_text
    existing.signals = score.signals
    session.flush()
    return existing, False


def ensure_content_draft(session: Session, candidate_id: int, template_id: int,
                         draft: dict) -> models.ContentDraft:
    """Create a system draft only if none exists; never overwrite curator edits."""
    existing = session.scalar(
        select(models.ContentDraft).where(
            models.ContentDraft.candidate_id == candidate_id,
            models.ContentDraft.deal_template_id == template_id))
    if existing is not None:
        return existing
    d = models.ContentDraft(candidate_id=candidate_id, deal_template_id=template_id, **draft)
    session.add(d)
    session.flush()
    return d
