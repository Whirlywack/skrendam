"""All Skrendam tables. Generic JSON type -> JSONB on Postgres, JSON on SQLite."""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from skrendam.db.base import Base


def _now() -> datetime:
    return datetime.utcnow()


class Zone(Base):
    __tablename__ = "zones"
    zone: Mapped[str] = mapped_column(String, primary_key=True)
    haul_type: Mapped[str] = mapped_column(String)
    threshold_price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_abs_savings_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origin: Mapped[str] = mapped_column(String, index=True)
    destination: Mapped[str] = mapped_column(String, index=True)
    zone: Mapped[str] = mapped_column(ForeignKey("zones.zone"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cabin: Mapped[str] = mapped_column(String, default="ECONOMY")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class AudienceSegment(Base):
    __tablename__ = "audience_segments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_itinerary_tolerance: Mapped[str] = mapped_column(String, default="normal")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class TravelMoment(Base):
    __tablename__ = "travel_moments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    moment_type: Mapped[str] = mapped_column(String)
    default_content_angle: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class DealTemplate(Base):
    __tablename__ = "deal_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    audience_segment_id: Mapped[int] = mapped_column(ForeignKey("audience_segments.id"))
    travel_moment_id: Mapped[int] = mapped_column(ForeignKey("travel_moments.id"))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    trip_type: Mapped[str] = mapped_column(String, default="oneway")
    newsletter_tag: Mapped[str | None] = mapped_column(String, nullable=True)
    public_label: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    included_origins: Mapped[list | None] = mapped_column(JSON, nullable=True)
    included_zones: Mapped[list | None] = mapped_column(JSON, nullable=True)
    included_destinations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    excluded_destinations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    nearby_origins_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    date_window_type: Mapped[str] = mapped_column(String, default="relative")
    rel_offset_start_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rel_offset_end_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    season_start_mmdd: Mapped[str | None] = mapped_column(String, nullable=True)
    season_end_mmdd: Mapped[str | None] = mapped_column(String, nullable=True)
    fixed_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fixed_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    preferred_departure_days: Mapped[list | None] = mapped_column(JSON, nullable=True)
    preferred_return_days: Mapped[list | None] = mapped_column(JSON, nullable=True)
    trip_len_min_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trip_len_max_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_abs_savings_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    psychological_price_threshold_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    allow_smaller_discount_if_under_price: Mapped[bool] = mapped_column(Boolean, default=False)
    cabin: Mapped[str] = mapped_column(String, default="ECONOMY")
    max_stops: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_total_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_layover_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_layover_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    allow_overnight_layover: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_airport_change: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_self_transfer: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_mixed_cabin: Mapped[bool] = mapped_column(Boolean, default=True)
    prefer_direct: Mapped[bool] = mapped_column(Boolean, default=False)
    family_friendly_times_only: Mapped[bool] = mapped_column(Boolean, default=False)
    latest_arrival_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    earliest_departure_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_angle: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_headline_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_hook_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    newsletter_section: Mapped[str | None] = mapped_column(String, nullable=True)
    publish_channel_default: Mapped[str] = mapped_column(String, default="public")
    rules_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    primary_scorer: Mapped[str] = mapped_column(
        String, default="weighted", server_default="weighted"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class ScanRun(Base):
    __tablename__ = "scan_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scanner_version: Mapped[str] = mapped_column(String)
    templates_scanned: Mapped[int] = mapped_column(Integer, default=0)
    routes_scanned: Mapped[int] = mapped_column(Integer, default=0)
    api_calls: Mapped[int] = mapped_column(Integer, default=0)
    http_429s: Mapped[int] = mapped_column(Integer, default=0)
    candidates_found: Mapped[int] = mapped_column(Integer, default=0)
    matches_created: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="running")
    health: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class PriceLog(Base):
    __tablename__ = "price_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("scan_runs.id"), index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    trip_type: Mapped[str] = mapped_column(String)
    travel_date: Mapped[date] = mapped_column(Date, index=True)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="EUR")
    scanner_version: Mapped[str] = mapped_column(String)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
    __table_args__ = (
        Index(
            "ix_price_log_route_trip_date_scanned",
            "route_id",
            "trip_type",
            "travel_date",
            "scanned_at",
        ),
    )


class Candidate(Base):
    __tablename__ = "candidates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("scan_runs.id"), nullable=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    origin: Mapped[str] = mapped_column(String)
    destination: Mapped[str] = mapped_column(String)
    zone: Mapped[str] = mapped_column(String)
    trip_type: Mapped[str] = mapped_column(String)
    travel_date: Mapped[date] = mapped_column(Date)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="EUR")
    baseline_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    itinerary_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    search_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, default="new")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scanner_version: Mapped[str | None] = mapped_column(String, nullable=True)
    deal_group_key: Mapped[str] = mapped_column(String, unique=True, index=True)


class CandidateTemplateMatch(Base):
    __tablename__ = "candidate_template_matches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"), index=True)
    match_score: Mapped[float] = mapped_column(Float)
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    gate_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score_0_100: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_tier: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_scorer: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class CandidateScore(Base):
    __tablename__ = "candidate_scores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"), index=True)
    scorer: Mapped[str] = mapped_column(String)
    value: Mapped[float] = mapped_column(Float)
    score_0_100: Mapped[int] = mapped_column(Integer)
    quality_tier: Mapped[str | None] = mapped_column(String, nullable=True)
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class VerificationCheck(Base):
    __tablename__ = "verification_checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    provider: Mapped[str] = mapped_column(String, default="fli")
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String, nullable=True)
    booking_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    available: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ContentDraft(Base):
    __tablename__ = "content_drafts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"))
    headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    newsletter_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")
    created_by: Mapped[str] = mapped_column(String, default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class PublishedDeal(Base):
    __tablename__ = "published_deals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"))
    content_draft_id: Mapped[int | None] = mapped_column(
        ForeignKey("content_drafts.id"), nullable=True
    )
    public_label: Mapped[str | None] = mapped_column(String, nullable=True)
    newsletter_tag: Mapped[str | None] = mapped_column(String, nullable=True)
    headline: Mapped[str] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin: Mapped[str] = mapped_column(String)
    destination: Mapped[str] = mapped_column(String)
    zone: Mapped[str | None] = mapped_column(String, nullable=True)
    trip_type: Mapped[str] = mapped_column(String)
    travel_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    baseline_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    booking_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    unverified_since: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Manual "posted to socials" markers set from the Deal Desk Live board.
    posted_tiktok_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    posted_instagram_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tier: Mapped[str] = mapped_column(String, default="free")
    status: Mapped[str] = mapped_column(String, default="live")
    going_fast: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    published_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, server_default=text("CURRENT_TIMESTAMP")
    )
    confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    confirm_token: Mapped[str | None] = mapped_column(String, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    early_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    prefs: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ScanRequest(Base):
    __tablename__ = "scan_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String)  # "full_scan" | "recheck"
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"))
    status: Mapped[str] = mapped_column(
        String, default="queued", server_default="queued", index=True
    )
    requested_by: Mapped[str] = mapped_column(String, default="curator", server_default="curator")
    params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, server_default=text("CURRENT_TIMESTAMP"), index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
