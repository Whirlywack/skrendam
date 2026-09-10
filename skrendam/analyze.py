"""Read-only analysis over real scan data — informs threshold tuning (spec A1)."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from skrendam.db import models


@dataclass
class TemplateVolume:
    template: str
    count: int


@dataclass
class ZoneVolume:
    zone: str
    count: int


@dataclass
class TierPreview:
    great: int
    maybe: int


@dataclass
class AnalysisReport:
    candidate_count: int
    match_count: int
    price_log_count: int
    discount_p10: float
    discount_p50: float
    discount_p90: float
    per_template: list[TemplateVolume] = field(default_factory=list)
    per_zone: list[ZoneVolume] = field(default_factory=list)
    tier_preview: TierPreview = field(default_factory=lambda: TierPreview(0, 0))


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((pct / 100.0) * (len(s) - 1))))
    return round(s[k], 1)


# quality_tier is written by the engine via skrendam/scanning/scoring/tiering.py
# (GREAT=88, RARE=94, 0–100 scale). great_threshold (0.88) is only the fallback for old,
# un-backfilled rows that predate the score_0_100/quality_tier columns.
def analyze(session: Session, great_threshold: float = 0.88) -> AnalysisReport:
    discounts = [d for (d,) in session.execute(
        select(models.Candidate.discount_pct).where(models.Candidate.discount_pct.is_not(None))
    )]
    match_rows = session.execute(
        select(models.CandidateTemplateMatch.quality_tier,
               models.CandidateTemplateMatch.match_score)).all()
    per_tmpl = session.execute(
        select(models.DealTemplate.name, func.count(models.CandidateTemplateMatch.id))
        .join(models.CandidateTemplateMatch,
              models.CandidateTemplateMatch.deal_template_id == models.DealTemplate.id)
        .group_by(models.DealTemplate.name)
        .order_by(func.count(models.CandidateTemplateMatch.id).desc())
    ).all()
    per_zone = session.execute(
        select(models.Candidate.zone, func.count(models.Candidate.id))
        .group_by(models.Candidate.zone)
        .order_by(func.count(models.Candidate.id).desc())
    ).all()
    great = sum(1 for tier, ms in match_rows
                if (tier in ("great", "rare"))
                or (tier is None and ms is not None and ms >= great_threshold))
    return AnalysisReport(
        candidate_count=session.scalar(select(func.count(models.Candidate.id))) or 0,
        match_count=len(match_rows),
        price_log_count=session.scalar(select(func.count(models.PriceLog.id))) or 0,
        discount_p10=_percentile(discounts, 10),
        discount_p50=_percentile(discounts, 50),
        discount_p90=_percentile(discounts, 90),
        per_template=[TemplateVolume(t, c) for (t, c) in per_tmpl],
        per_zone=[ZoneVolume(z, c) for (z, c) in per_zone],
        tier_preview=TierPreview(great=great, maybe=len(match_rows) - great),
    )


def _price_band(p: float) -> str:
    return "<50" if p < 50 else "50–99" if p < 100 else "100–199" if p < 200 else "200+"


def _commodity_bucket(share) -> str:
    if share is None:
        return "unknown"
    return "<0.2" if share < 0.2 else "0.2–0.5" if share < 0.5 else "≥0.5"


def label_report(session: Session) -> str:
    """Curator labels (approved/rejected) as a proxy for "what counts as a deal".

    Grouped by zone x template x price band x commodity bucket (spec WP2.11).
    """
    rows = session.execute(
        select(
            models.Candidate.zone,
            models.DealTemplate.name,
            models.Candidate.price,
            models.Candidate.status,
            models.CandidateTemplateMatch.demand_signals,
        )
        .join(
            models.CandidateTemplateMatch,
            models.CandidateTemplateMatch.candidate_id == models.Candidate.id,
        )
        .join(
            models.DealTemplate,
            models.DealTemplate.id == models.CandidateTemplateMatch.deal_template_id,
        )
        .where(models.Candidate.status.in_(("approved", "rejected")))
    ).all()
    agg: dict[tuple, list[int]] = {}
    for zone, tname, price, status, signals in rows:
        key = (
            zone,
            tname,
            _price_band(price),
            _commodity_bucket((signals or {}).get("commodity_share")),
        )
        a = agg.setdefault(key, [0, 0])
        a[0 if status == "approved" else 1] += 1
    lines = [
        "| zone | template | price band | commodity | approved | rejected | approval |",
        "|---|---|---|---|---|---|---|",
    ]
    for (zone, tname, band, bucket), (ok, no) in sorted(agg.items()):
        rate = f"{round(100 * ok / (ok + no))}%"
        lines.append(f"| {zone} | {tname} | {band} | {bucket} | {ok} | {no} | {rate} |")
    return "\n".join(lines)


def format_report(rep: AnalysisReport) -> str:
    lines = [
        "=== Skrendam tuning analysis ===",
        f"candidates: {rep.candidate_count} | matches: {rep.match_count} | price points: {rep.price_log_count}",
        f"discount % (p10/p50/p90): {rep.discount_p10} / {rep.discount_p50} / {rep.discount_p90}",
        f"tier preview: {rep.tier_preview.great} great / {rep.tier_preview.maybe} maybe",
        "-- candidates per template --",
        *[f"  {t.template}: {t.count}" for t in rep.per_template],
        "-- candidates per zone --",
        *[f"  {z.zone}: {z.count}" for z in rep.per_zone],
    ]
    return "\n".join(lines)
