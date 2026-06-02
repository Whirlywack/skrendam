# Deal Engine (Scanner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the internal Python deal engine that scans Google Flights (via the `fli` library) along structured deal templates, scores fares into a queue of candidates linked to every template they match, and persists everything to Postgres for the curator admin (Plan 2) to read.

**Architecture:** A warm, long-lived Python worker. Pure, fixture-tested logic modules (pacing, resolver, baseline, matching, dedup, content) sit behind a thin `fli` adapter and SQLAlchemy repositories. An orchestrator (`run_scan`) wires them together; APScheduler triggers it daily. Alembic owns the schema (the source of truth the Next.js admin later introspects).

**Tech Stack:** Python 3.13, `uv`, `fli` (`flights` pkg), SQLAlchemy 2.0, Alembic, pydantic-settings, APScheduler, tenacity, pytest. Models use SQLAlchemy generic types (`JSON`, not PG `JSONB`) so unit/integration tests run on in-memory SQLite while production uses Postgres.

This plan implements [`docs/superpowers/specs/2026-06-01-deal-engine-curator-design.md`](../specs/2026-06-01-deal-engine-curator-design.md) (v4). Sections referenced as "§N".

---

## File Structure

```
skrendam/                         # new top-level package (imports the installed `fli`/`flights`)
  __init__.py
  config.py                       # Settings (DATABASE_URL, FLI_TIMEOUT, pacing knobs, SCANNER_VERSION)
  db/
    __init__.py
    base.py                       # SQLAlchemy Declarative Base
    models.py                     # all tables (§6)
    session.py                    # engine + sessionmaker factory
    repositories.py               # upsert/insert helpers (DB-agnostic select-then-write)
  fli_adapter/
    __init__.py
    errors.py                     # ScanError hierarchy
    pacing.py                     # TokenBucket, backoff wrapper, CircuitBreaker
    adapter.py                    # search_calendar / search_flights + within-run cache
  scanning/
    __init__.py
    types.py                      # dataclasses: SearchSpec, CalendarPoint, FareItinerary, Baseline, MatchResult
    dedup.py                      # deal_group_key + price_band
    resolver.py                   # resolve(template, today) -> list[SearchSpec]
    baseline.py                   # compute_baseline(points) -> Baseline
    matching.py                   # match(candidate, template, baseline, zone) -> MatchResult | None
    content.py                    # build_content_draft(candidate, template) -> dict
    orchestrator.py               # run_scan(session, today, adapter) -> ScanSummary
  verification.py                 # recheck_candidate(session, candidate, adapter)
  calibrate.py                    # seed zones thresholds from a real scan
  scheduler.py                    # APScheduler daily trigger
  seeds.py                        # seed zones/routes/audience_segments/travel_moments/deal_templates
  cli.py                          # `python -m skrendam.cli run-scan|calibrate|seed`
alembic/
  env.py
  versions/                       # migrations
alembic.ini
tests/skrendam/
  conftest.py                     # in-memory SQLite session fixture
  fixtures/                       # captured SearchDates / SearchFlights JSON
  test_*.py
```

**Responsibilities:** logic modules under `scanning/` are pure (no I/O) and fixture-tested. `fli_adapter/` is the only code importing `fli`. `db/` is the only code touching SQLAlchemy. `orchestrator.py` is the only place that wires them. This keeps each file focused and independently testable.

---

## Task 1: Project scaffolding + config

**Files:**
- Create: `skrendam/__init__.py`, `skrendam/config.py`
- Modify: `pyproject.toml` (add deps + an optional `skrendam` extra)
- Test: `tests/skrendam/test_config.py`, `tests/skrendam/conftest.py`

- [ ] **Step 1: Add dependencies**

In `pyproject.toml`, under `[project.optional-dependencies]` add:

```toml
skrendam = [
    "sqlalchemy>=2.0",
    "alembic>=1.13",
    "pydantic-settings>=2.0",
    "apscheduler>=3.10",
    "tenacity>=9.0",
]
```

Run: `uv sync --all-extras --python 3.13`
Expected: resolves and installs without error.

- [ ] **Step 2: Write the failing test**

```python
# tests/skrendam/test_config.py
from skrendam.config import Settings


def test_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", "sqlite:///x.db")
    monkeypatch.setenv("SKRENDAM_FLI_TIMEOUT", "25")
    s = Settings()
    assert s.database_url == "sqlite:///x.db"
    assert s.fli_timeout == 25.0
    assert s.min_call_interval_seconds >= 1.0  # default pacing
    assert s.scanner_version  # non-empty
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'skrendam'`.

- [ ] **Step 4: Write minimal implementation**

```python
# skrendam/__init__.py
"""Skrendam internal deal engine."""
```

```python
# skrendam/config.py
"""Runtime configuration, read from SKRENDAM_-prefixed environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SKRENDAM_", extra="ignore")

    database_url: str = "sqlite+pysqlite:///:memory:"
    fli_timeout: float = 25.0
    # Pacing: our own ceiling, far below fli's 10/sec built-in limit.
    min_call_interval_seconds: float = 1.5
    pacing_jitter_seconds: float = 0.5
    circuit_breaker_threshold: int = 5  # consecutive failures before pausing a run
    scanner_version: str = "0.1.0"
    currency: str = "EUR"
    language: str = "lt"
    country: str = "LT"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_config.py -v`
Expected: PASS.

- [ ] **Step 6: Add the shared test DB fixture**

```python
# tests/skrendam/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.db.base import Base
from skrendam.db import models  # noqa: F401 — register all tables on Base.metadata


@pytest.fixture
def session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    try:
        yield s
    finally:
        s.close()
```

(The import targets land in Task 2; this file will error until then — that's expected and fixed by Task 2.)

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml uv.lock skrendam/ tests/skrendam/test_config.py tests/skrendam/conftest.py
git commit -m "feat(skrendam): project scaffolding + settings"
```

---

## Task 2: Database models

**Files:**
- Create: `skrendam/db/__init__.py`, `skrendam/db/base.py`, `skrendam/db/models.py`, `skrendam/db/session.py`
- Test: `tests/skrendam/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_models.py
from datetime import date, datetime

from skrendam.db import models


def test_can_persist_core_rows(session):
    z = models.Zone(zone="MEDITERRANEAN", haul_type="short",
                     threshold_price_eur=60, min_abs_savings_eur=30, min_discount_pct=25)
    r = models.Route(origin="VNO", destination="BCN", zone="MEDITERRANEAN", enabled=True)
    aud = models.AudienceSegment(slug="families", name="Families",
                                 default_itinerary_tolerance="strict")
    mom = models.TravelMoment(slug="summer", name="Summer", moment_type="seasonal")
    session.add_all([z, r, aud, mom])
    session.flush()

    tpl = models.DealTemplate(slug="summer-sun", name="Summer sun", enabled=True,
                              audience_segment_id=aud.id, travel_moment_id=mom.id,
                              trip_type="roundtrip", date_window_type="seasonal",
                              season_start_mmdd="06-01", season_end_mmdd="08-31",
                              included_zones=["MEDITERRANEAN"], trip_len_min_days=4,
                              trip_len_max_days=10, priority=10)
    session.add(tpl)
    session.flush()

    cand = models.Candidate(route_id=r.id, origin="VNO", destination="BCN",
                            zone="MEDITERRANEAN", trip_type="roundtrip",
                            travel_date=date(2026, 7, 10), price=120, currency="EUR",
                            baseline_price=200, discount_pct=40, status="new",
                            deal_group_key="VNO|BCN|roundtrip|2026-07-10|120",
                            first_seen_at=datetime(2026, 6, 2), last_seen_at=datetime(2026, 6, 2))
    session.add(cand)
    session.flush()

    m = models.CandidateTemplateMatch(candidate_id=cand.id, deal_template_id=tpl.id,
                                      match_score=0.82, reason_text="40% below baseline")
    session.add(m)
    session.commit()

    assert cand.id is not None
    assert m.candidate_id == cand.id
    assert session.query(models.Candidate).count() == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'skrendam.db'`.

- [ ] **Step 3: Write the base + session**

```python
# skrendam/db/__init__.py
```

```python
# skrendam/db/base.py
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

```python
# skrendam/db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.config import Settings


def make_sessionmaker(settings: Settings | None = None):
    settings = settings or Settings()
    engine = create_engine(settings.database_url, future=True)
    return sessionmaker(bind=engine, future=True)
```

- [ ] **Step 4: Write the models**

```python
# skrendam/db/models.py
"""All Skrendam tables (spec §6). Generic JSON type → JSONB on Postgres, JSON on SQLite."""

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from skrendam.db.base import Base


def _now() -> datetime:
    return datetime.utcnow()


class Zone(Base):
    __tablename__ = "zones"
    zone: Mapped[str] = mapped_column(String, primary_key=True)
    haul_type: Mapped[str] = mapped_column(String)  # short|medium|long
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
    moment_type: Mapped[str] = mapped_column(String)  # seasonal|relative|fixed_dates|recurring
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
    trip_type: Mapped[str] = mapped_column(String, default="oneway")  # oneway|roundtrip
    newsletter_tag: Mapped[str | None] = mapped_column(String, nullable=True)
    public_label: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # origins / destinations
    included_origins: Mapped[list | None] = mapped_column(JSON, nullable=True)
    included_zones: Mapped[list | None] = mapped_column(JSON, nullable=True)
    included_destinations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    excluded_destinations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    nearby_origins_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    # date / timing
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
    # fare / value
    max_price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_discount_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_abs_savings_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    psychological_price_threshold_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    allow_smaller_discount_if_under_price: Mapped[bool] = mapped_column(Boolean, default=False)
    # itinerary quality
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
    # content / publishing
    content_angle: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_headline_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    tiktok_hook_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    newsletter_section: Mapped[str | None] = mapped_column(String, nullable=True)
    publish_channel_default: Mapped[str] = mapped_column(String, default="public")
    rules_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
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


class PriceLog(Base):
    __tablename__ = "price_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("scan_runs.id"))
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    trip_type: Mapped[str] = mapped_column(String)
    travel_date: Mapped[date] = mapped_column(Date, index=True)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="EUR")
    scanner_version: Mapped[str] = mapped_column(String)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)


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
    status: Mapped[str] = mapped_column(String, default="new")  # new|seen|maybe|approved|edited|rejected|expired
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
    status: Mapped[str] = mapped_column(String, default="draft")  # draft|used|discarded
    created_by: Mapped[str] = mapped_column(String, default="system")  # system|curator|ai_future
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class PublishedDeal(Base):
    __tablename__ = "published_deals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"))
    content_draft_id: Mapped[int | None] = mapped_column(ForeignKey("content_drafts.id"), nullable=True)
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
    tier: Mapped[str] = mapped_column(String, default="free")
    status: Mapped[str] = mapped_column(String, default="live")  # live|expired|unpublished
    published_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/skrendam/test_models.py tests/skrendam/test_config.py -v`
Expected: PASS (conftest import now resolves).

- [ ] **Step 6: Commit**

```bash
git add skrendam/db/ tests/skrendam/test_models.py
git commit -m "feat(skrendam): SQLAlchemy models for all tables"
```

---

## Task 3: Alembic setup + initial migration

**Files:**
- Create: `alembic.ini`, `alembic/env.py`, `alembic/versions/0001_initial.py`
- Test: `tests/skrendam/test_migration.py`

- [ ] **Step 1: Initialise Alembic**

Run: `uv run alembic init alembic`
Then edit `alembic/env.py` to point at our metadata:

```python
# alembic/env.py — replace the target_metadata line and config URL wiring
from skrendam.config import Settings
from skrendam.db.base import Base
from skrendam.db import models  # noqa: F401

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", Settings().database_url)
```

- [ ] **Step 2: Write the failing test**

```python
# tests/skrendam/test_migration.py
import subprocess


def test_autogenerate_reports_no_diff(tmp_path, monkeypatch):
    """After the initial migration, autogenerate should detect no model drift."""
    db = tmp_path / "m.db"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", f"sqlite+pysqlite:///{db}")
    up = subprocess.run(["uv", "run", "alembic", "upgrade", "head"],
                        capture_output=True, text=True)
    assert up.returncode == 0, up.stderr
    chk = subprocess.run(["uv", "run", "alembic", "check"], capture_output=True, text=True)
    assert chk.returncode == 0, chk.stdout + chk.stderr
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_migration.py -v`
Expected: FAIL — no migration exists yet (`alembic upgrade` finds no revisions / `check` reports diffs).

- [ ] **Step 4: Generate the initial migration**

Run: `uv run alembic revision --autogenerate -m "initial"`
This writes a new file under `alembic/versions/` (rename it to `0001_initial.py` if you like). Open it and confirm it creates **all 12 tables** from `models.py`: `zones`, `routes`, `audience_segments`, `travel_moments`, `deal_templates`, `scan_runs`, `price_log`, `candidates`, `candidate_template_matches`, `verification_checks`, `content_drafts`, `published_deals`.

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_migration.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add alembic.ini alembic/ tests/skrendam/test_migration.py
git commit -m "feat(skrendam): alembic setup + initial schema migration"
```

---

## Task 4: Fare identity (`deal_group_key` + price band)

**Files:**
- Create: `skrendam/scanning/__init__.py`, `skrendam/scanning/types.py`, `skrendam/scanning/dedup.py`
- Test: `tests/skrendam/test_dedup.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_dedup.py
from datetime import date

from skrendam.scanning.dedup import deal_group_key, price_band


def test_price_band_buckets_by_5_eur():
    assert price_band(29) == price_band(30) == 30   # rounds up to nearest 5
    assert price_band(31) == 35


def test_oneway_key_is_stable_and_excludes_template():
    k1 = deal_group_key("VNO", "BCN", "oneway", date(2026, 7, 29), None, 30.0)
    k2 = deal_group_key("VNO", "BCN", "oneway", date(2026, 7, 29), None, 31.0)  # same band
    assert k1 == k2 == "VNO|BCN|oneway|2026-07-29|30"


def test_roundtrip_key_includes_return_date():
    k = deal_group_key("VNO", "BCN", "roundtrip", date(2026, 7, 10), date(2026, 7, 14), 120.0)
    assert k == "VNO|BCN|roundtrip|2026-07-10|2026-07-14|120"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_dedup.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```python
# skrendam/scanning/__init__.py
```

```python
# skrendam/scanning/dedup.py
"""Fare identity: a candidate is one real fare, independent of which template found it."""

import math
from datetime import date

PRICE_BAND_EUR = 5


def price_band(price: float) -> int:
    """Bucket a price to the nearest PRICE_BAND_EUR (rounding up) to absorb tiny moves."""
    return int(math.ceil(price / PRICE_BAND_EUR) * PRICE_BAND_EUR)


def deal_group_key(origin: str, destination: str, trip_type: str,
                   travel_date: date, return_date: date | None, price: float) -> str:
    parts = [origin, destination, trip_type, travel_date.isoformat()]
    if return_date is not None:
        parts.append(return_date.isoformat())
    parts.append(str(price_band(price)))
    return "|".join(parts)
```

- [ ] **Step 4: Add shared dataclasses (used by later tasks)**

```python
# skrendam/scanning/types.py
"""Plain data passed between pure logic modules (no I/O, no ORM)."""

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class SearchSpec:
    origin: str
    destination: str
    trip_type: str            # oneway|roundtrip
    window_start: date
    window_end: date
    duration_days: int | None  # set for roundtrip, else None
    cabin: str = "ECONOMY"


@dataclass(frozen=True)
class CalendarPoint:
    travel_date: date
    return_date: date | None
    price: float


@dataclass
class FareItinerary:
    price: float
    currency: str
    stops: int
    duration_minutes: int
    legs: list[dict]
    self_transfer: bool = False
    mixed_cabin: bool = False
    airport_change: bool = False
    overnight_layover: bool = False
    max_layover_minutes: int | None = None
    booking_url: str | None = None
    raw: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Baseline:
    minimum: float
    median: float
    decile: float        # 10th-percentile price across the window
    sample_size: int


@dataclass(frozen=True)
class MatchResult:
    match_score: float
    reason_text: str
    gate_results: dict
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_dedup.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skrendam/scanning/ tests/skrendam/test_dedup.py
git commit -m "feat(skrendam): fare identity (deal_group_key) + shared types"
```

---

## Task 5: Pacing — token bucket, backoff, circuit breaker

**Files:**
- Create: `skrendam/fli_adapter/__init__.py`, `skrendam/fli_adapter/errors.py`, `skrendam/fli_adapter/pacing.py`
- Test: `tests/skrendam/test_pacing.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_pacing.py
from skrendam.fli_adapter.pacing import CircuitBreaker, TokenBucket


def test_token_bucket_waits_until_interval(monkeypatch):
    clock = {"t": 0.0}
    sleeps = []
    bucket = TokenBucket(min_interval=1.5, jitter=0.0,
                         now=lambda: clock["t"], sleep=lambda s: (sleeps.append(s),
                                                                  clock.__setitem__("t", clock["t"] + s)))
    bucket.acquire()            # first call: no wait
    bucket.acquire()            # immediately after: must wait ~1.5s
    assert sleeps and abs(sleeps[-1] - 1.5) < 1e-6


def test_circuit_breaker_trips_after_threshold():
    cb = CircuitBreaker(threshold=3)
    for _ in range(2):
        cb.record_failure()
    assert not cb.is_open()
    cb.record_failure()
    assert cb.is_open()
    cb.record_success()
    assert not cb.is_open()  # success resets the streak
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_pacing.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the errors module**

```python
# skrendam/fli_adapter/__init__.py
```

```python
# skrendam/fli_adapter/errors.py
class ScanError(Exception):
    """Base for adapter failures."""


class RateLimitedError(ScanError):
    pass


class TimeoutError_(ScanError):
    pass


class ConnectionError_(ScanError):
    pass


class ParseError(ScanError):
    pass
```

- [ ] **Step 4: Write the pacing implementation**

```python
# skrendam/fli_adapter/pacing.py
"""Our own pacing on top of fli's built-in limiter — deliberately slower than 10/sec."""

import random
import time
from collections.abc import Callable


class TokenBucket:
    """Spaces calls at least `min_interval` seconds apart (+ optional jitter)."""

    def __init__(self, min_interval: float, jitter: float = 0.0,
                 now: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep):
        self.min_interval = min_interval
        self.jitter = jitter
        self._now = now
        self._sleep = sleep
        self._last: float | None = None

    def acquire(self) -> None:
        now = self._now()
        if self._last is not None:
            wait = self.min_interval - (now - self._last)
            if wait > 0:
                self._sleep(wait)
        extra = random.uniform(0, self.jitter) if self.jitter else 0.0
        if extra:
            self._sleep(extra)
        self._last = self._now()


class CircuitBreaker:
    """Trips open after `threshold` consecutive failures; any success resets it."""

    def __init__(self, threshold: int):
        self.threshold = threshold
        self._consecutive = 0

    def record_failure(self) -> None:
        self._consecutive += 1

    def record_success(self) -> None:
        self._consecutive = 0

    def is_open(self) -> bool:
        return self._consecutive >= self.threshold
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_pacing.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skrendam/fli_adapter/ tests/skrendam/test_pacing.py
git commit -m "feat(skrendam): pacing token bucket, circuit breaker, ScanError types"
```

---

## Task 6: `fli` adapter (calendar + flights + within-run cache)

**Files:**
- Create: `skrendam/fli_adapter/adapter.py`
- Test: `tests/skrendam/test_adapter.py`

The adapter is the only code importing `fli`. It accepts an injected "search backend" so tests never hit the network; production wires the real `fli` calls.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_adapter.py
from datetime import date

from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import RateLimitedError
from skrendam.scanning.types import SearchSpec


class FakeBackend:
    def __init__(self):
        self.calendar_calls = 0

    def search_calendar(self, spec):
        self.calendar_calls += 1
        return [(date(2026, 7, 29), None, 30.0), (date(2026, 7, 30), None, 55.0)]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}, "flight_number": "1913"}],
                 "self_transfer": False, "mixed_cabin": False, "booking_url": "https://x"}]


def _spec():
    return SearchSpec("VNO", "BCN", "oneway", date(2026, 7, 1), date(2026, 8, 31), None)


def test_calendar_results_are_cached_within_run():
    backend = FakeBackend()
    adapter = FliAdapter(backend, pace=lambda: None)
    a = adapter.search_calendar(_spec())
    b = adapter.search_calendar(_spec())          # identical spec
    assert backend.calendar_calls == 1            # served from cache the 2nd time
    assert a[0].price == 30.0 and a == b
    assert adapter.api_calls == 1


def test_flights_are_parsed_into_fare_itinerary():
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    fares = adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    assert fares[0].price == 30.0 and fares[0].stops == 0 and fares[0].duration_minutes == 215


def test_backend_error_is_wrapped(monkeypatch):
    class Boom(FakeBackend):
        def search_flights(self, *a, **k):
            raise RuntimeError("HTTP 429")
    adapter = FliAdapter(Boom(), pace=lambda: None)
    try:
        adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
        assert False, "expected error"
    except RateLimitedError:
        pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_adapter.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the adapter**

```python
# skrendam/fli_adapter/adapter.py
"""The only module that talks to a flight-search backend. Pure plumbing + caching."""

from collections.abc import Callable
from datetime import date

from skrendam.fli_adapter.errors import (
    ConnectionError_,
    ParseError,
    RateLimitedError,
    ScanError,
    TimeoutError_,
)
from skrendam.scanning.types import CalendarPoint, FareItinerary, SearchSpec


def _classify(exc: Exception) -> ScanError:
    msg = str(exc).lower()
    if "429" in msg or "rate" in msg:
        return RateLimitedError(str(exc))
    if "timed out" in msg or "timeout" in msg:
        return TimeoutError_(str(exc))
    if "connect" in msg or "dns" in msg:
        return ConnectionError_(str(exc))
    return ScanError(str(exc))


class FliAdapter:
    def __init__(self, backend, pace: Callable[[], None]):
        self._backend = backend
        self._pace = pace
        self._cache: dict[tuple, list[CalendarPoint]] = {}
        self.api_calls = 0

    def search_calendar(self, spec: SearchSpec) -> list[CalendarPoint]:
        key = (spec.origin, spec.destination, spec.trip_type, spec.window_start,
               spec.window_end, spec.duration_days, spec.cabin)
        if key in self._cache:
            return self._cache[key]
        self._pace()
        self.api_calls += 1
        try:
            rows = self._backend.search_calendar(spec)
        except Exception as exc:  # noqa: BLE001 — re-raised as typed ScanError
            raise _classify(exc) from exc
        points = [CalendarPoint(td, rd, float(p)) for (td, rd, p) in rows]
        self._cache[key] = points
        return points

    def search_flights(self, origin: str, destination: str, travel_date: date,
                       return_date: date | None, cabin: str) -> list[FareItinerary]:
        self._pace()
        self.api_calls += 1
        try:
            raw = self._backend.search_flights(origin, destination, travel_date,
                                               return_date, cabin)
        except Exception as exc:  # noqa: BLE001
            raise _classify(exc) from exc
        return [self._to_itinerary(r) for r in raw]

    @staticmethod
    def _to_itinerary(r: dict) -> FareItinerary:
        try:
            return FareItinerary(
                price=float(r["price"]), currency=r.get("currency", "EUR"),
                stops=int(r.get("stops", 0)), duration_minutes=int(r.get("duration", 0)),
                legs=r.get("legs", []), self_transfer=bool(r.get("self_transfer", False)),
                mixed_cabin=bool(r.get("mixed_cabin", False)),
                booking_url=r.get("booking_url"), raw=r,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ParseError(f"unexpected flight shape: {exc}") from exc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_adapter.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/fli_adapter/adapter.py tests/skrendam/test_adapter.py
git commit -m "feat(skrendam): fli adapter with within-run cache + error mapping"
```

---

## Task 7: Template resolver

**Files:**
- Create: `skrendam/scanning/resolver.py`
- Test: `tests/skrendam/test_resolver.py`

The resolver is pure: it takes a `DealTemplate`, the `routes` it may use, and a fixed `today`, and returns concrete `SearchSpec`s. Passing `today` in keeps it deterministic.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_resolver.py
from datetime import date

from skrendam.db import models
from skrendam.scanning.resolver import resolve


def _routes():
    return [
        models.Route(id=1, origin="VNO", destination="BCN", zone="MEDITERRANEAN", enabled=True),
        models.Route(id=2, origin="VNO", destination="OSL", zone="SCANDINAVIA", enabled=True),
        models.Route(id=3, origin="KUN", destination="AGP", zone="MEDITERRANEAN", enabled=False),
    ]


def test_relative_oneway_window_and_zone_filter():
    tpl = models.DealTemplate(
        slug="lastminute", name="x", trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=3, rel_offset_end_days=21, included_zones=["MEDITERRANEAN"],
        included_origins=["VNO", "KUN"])
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    # Only the enabled MEDITERRANEAN route from an included origin (VNO->BCN) qualifies.
    assert len(specs) == 1
    s = specs[0]
    assert (s.origin, s.destination, s.trip_type) == ("VNO", "BCN", "oneway")
    assert s.window_start == date(2026, 6, 5) and s.window_end == date(2026, 6, 23)
    assert s.duration_days is None


def test_seasonal_window_rolls_to_next_occurrence():
    tpl = models.DealTemplate(
        slug="summer", name="x", trip_type="roundtrip", date_window_type="seasonal",
        season_start_mmdd="06-01", season_end_mmdd="08-31", included_zones=["MEDITERRANEAN"],
        trip_len_min_days=4, trip_len_max_days=10)
    # today after the season start → window uses this year's remaining season
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    s = specs[0]
    assert s.window_start == date(2026, 6, 2)      # clamp to today if season already started
    assert s.window_end == date(2026, 8, 31)
    assert s.duration_days == 4                     # representative = trip_len_min_days


def test_seasonal_before_start_uses_this_year():
    tpl = models.DealTemplate(
        slug="xmas", name="x", trip_type="roundtrip", date_window_type="fixed",
        fixed_start_date=date(2026, 12, 1), fixed_end_date=date(2026, 12, 23),
        included_zones=["MEDITERRANEAN"], trip_len_min_days=2, trip_len_max_days=4)
    specs = resolve(tpl, _routes(), today=date(2026, 6, 2))
    assert specs[0].window_start == date(2026, 12, 1)
    assert specs[0].window_end == date(2026, 12, 23)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_resolver.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the resolver**

```python
# skrendam/scanning/resolver.py
"""Turn a deal template into concrete (route, window, trip_type) search specs."""

from datetime import date, timedelta

from skrendam.db import models
from skrendam.scanning.types import SearchSpec

MAX_FUTURE_DAYS = 305  # fli's ceiling


def _window(tpl: "models.DealTemplate", today: date) -> tuple[date, date]:
    if tpl.date_window_type == "relative":
        start = today + timedelta(days=tpl.rel_offset_start_days or 0)
        end = today + timedelta(days=tpl.rel_offset_end_days or 0)
    elif tpl.date_window_type == "seasonal":
        sm, sd = (int(x) for x in tpl.season_start_mmdd.split("-"))
        em, ed = (int(x) for x in tpl.season_end_mmdd.split("-"))
        start = date(today.year, sm, sd)
        end = date(today.year, em, ed)
        if end < today:                       # season already passed this year → next year
            start = date(today.year + 1, sm, sd)
            end = date(today.year + 1, em, ed)
        start = max(start, today)             # never scan the past
    elif tpl.date_window_type == "fixed":
        start, end = tpl.fixed_start_date, tpl.fixed_end_date
        start = max(start, today)
    else:
        raise ValueError(f"unknown date_window_type {tpl.date_window_type!r}")
    horizon = today + timedelta(days=MAX_FUTURE_DAYS)
    return start, min(end, horizon)


def _destinations_ok(tpl: "models.DealTemplate", route: "models.Route") -> bool:
    if tpl.included_origins and route.origin not in tpl.included_origins:
        return False
    if tpl.included_destinations and route.destination not in tpl.included_destinations:
        return False
    if tpl.excluded_destinations and route.destination in tpl.excluded_destinations:
        return False
    if tpl.included_zones and route.zone not in tpl.included_zones:
        return False
    return True


def resolve(tpl: "models.DealTemplate", routes: list["models.Route"],
            today: date) -> list[SearchSpec]:
    start, end = _window(tpl, today)
    if start > end:
        return []
    duration = tpl.trip_len_min_days if tpl.trip_type == "roundtrip" else None
    specs: list[SearchSpec] = []
    for r in routes:
        if not r.enabled or not _destinations_ok(tpl, r):
            continue
        specs.append(SearchSpec(r.origin, r.destination, tpl.trip_type,
                                start, end, duration, tpl.cabin or "ECONOMY"))
    return specs
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_resolver.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/resolver.py tests/skrendam/test_resolver.py
git commit -m "feat(skrendam): template resolver (relative/seasonal/fixed windows)"
```

---

## Task 8: Baseline computation

**Files:**
- Create: `skrendam/scanning/baseline.py`
- Test: `tests/skrendam/test_baseline.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_baseline.py
from datetime import date

from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.types import CalendarPoint


def _pts(prices):
    return [CalendarPoint(date(2026, 7, 1 + i), None, p) for i, p in enumerate(prices)]


def test_baseline_min_median_decile():
    b = compute_baseline(_pts([30, 40, 50, 60, 70, 80, 90, 100, 110, 120]))
    assert b.minimum == 30
    assert b.sample_size == 10
    assert b.median == 75            # average of 70 and 80
    assert b.decile <= b.median      # 10th percentile near the cheap end


def test_empty_returns_none():
    assert compute_baseline([]) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_baseline.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/scanning/baseline.py
"""Window-relative baseline — our 'what is normal for this route' signal (no history needed)."""

import statistics

from skrendam.scanning.types import Baseline, CalendarPoint


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        raise ValueError("empty")
    k = (len(sorted_vals) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)


def compute_baseline(points: list[CalendarPoint]) -> Baseline | None:
    prices = sorted(p.price for p in points)
    if not prices:
        return None
    return Baseline(
        minimum=prices[0],
        median=statistics.median(prices),
        decile=_percentile(prices, 0.10),
        sample_size=len(prices),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_baseline.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/baseline.py tests/skrendam/test_baseline.py
git commit -m "feat(skrendam): window-relative baseline"
```

---

## Task 9: Matching (gates + score + reason)

**Files:**
- Create: `skrendam/scanning/matching.py`
- Test: `tests/skrendam/test_matching.py`

`match()` decides whether a fare clears a template's gates and, if so, scores it. Effective thresholds come from the template, falling back to the zone.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_matching.py
from skrendam.db import models
from skrendam.scanning.matching import match
from skrendam.scanning.types import Baseline, FareItinerary


def _zone():
    return models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                       min_abs_savings_eur=30, min_discount_pct=25)


def _tpl(**kw):
    base = dict(slug="t", name="t", trip_type="oneway", max_stops=1, prefer_direct=False,
                allow_self_transfer=False, allow_mixed_cabin=False)
    base.update(kw)
    return models.DealTemplate(**base)


def _fare(price=30, stops=0, dur=215, **kw):
    return FareItinerary(price=price, currency="EUR", stops=stops, duration_minutes=dur,
                         legs=[{"airline": {"code": "W6"}}], **kw)


BASE = Baseline(minimum=30, median=60, decile=34, sample_size=20)


def test_strong_cheap_clean_fare_matches():
    r = match(_fare(price=30), _tpl(), BASE, _zone())
    assert r is not None
    assert r.match_score > 0.6
    assert "below" in r.reason_text.lower()
    assert r.gate_results["price_anomaly"] is True
    assert r.gate_results["itinerary_sanity"] is True


def test_fare_above_threshold_and_baseline_is_rejected():
    assert match(_fare(price=59), _tpl(max_price_eur=40, min_discount_pct=25), BASE, _zone()) is None


def test_too_many_stops_fails_itinerary_gate():
    assert match(_fare(price=30, stops=2), _tpl(max_stops=1), BASE, _zone()) is None


def test_self_transfer_rejected_when_not_allowed():
    assert match(_fare(price=30, self_transfer=True), _tpl(allow_self_transfer=False),
                 BASE, _zone()) is None


def test_smaller_discount_allowed_under_psychological_price():
    # 10% below baseline (weak) but under €40 psychological threshold with the relax flag on.
    tpl = _tpl(min_discount_pct=25, psychological_price_threshold_eur=40,
               allow_smaller_discount_if_under_price=True)
    assert match(_fare(price=39), tpl, BASE, _zone()) is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_matching.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/scanning/matching.py
"""Per-template gates + weighted match score (spec §8). Pure: template + zone + fare in, MatchResult out."""

from skrendam.db import models
from skrendam.scanning.types import Baseline, FareItinerary, MatchResult

WEIGHTS = {"price_anomaly": 0.50, "itinerary_quality": 0.20,
           "bookability": 0.15, "urgency": 0.15}
SEND_THRESHOLD = 0.55
STRONG_ANOMALY_DISCOUNT = 0.20  # price-anomaly must be strong on its own


def _eff(tpl, zone, name):
    """Template value if set, else the zone default."""
    v = getattr(tpl, name, None)
    return v if v is not None else getattr(zone, name, None)


def match(fare: FareItinerary, tpl: "models.DealTemplate", baseline: Baseline,
          zone: "models.Zone") -> MatchResult | None:
    gates: dict = {}
    discount = 0.0 if baseline.median <= 0 else (baseline.median - fare.price) / baseline.median
    abs_savings = max(0.0, baseline.median - fare.price)

    # Gate 1: price anomaly (hard)
    max_price = _eff(tpl, zone, "max_price_eur")
    min_disc = _eff(tpl, zone, "min_discount_pct")
    min_disc_frac = (min_disc / 100.0) if min_disc else 0.0
    under_price = max_price is not None and fare.price <= max_price
    under_psych = (tpl.psychological_price_threshold_eur is not None
                   and fare.price <= tpl.psychological_price_threshold_eur)
    needed_disc = 0.0 if (tpl.allow_smaller_discount_if_under_price and under_psych) else min_disc_frac
    price_anomaly = (discount >= needed_disc) or under_price or under_psych
    gates["price_anomaly"] = bool(price_anomaly)
    if not price_anomaly:
        return None

    # Gate 2: itinerary sanity (hard)
    itinerary_ok = True
    if tpl.max_stops is not None and fare.stops > tpl.max_stops:
        itinerary_ok = False
    if tpl.max_total_duration_minutes and fare.duration_minutes > tpl.max_total_duration_minutes:
        itinerary_ok = False
    if not tpl.allow_self_transfer and fare.self_transfer:
        itinerary_ok = False
    if not tpl.allow_mixed_cabin and fare.mixed_cabin:
        itinerary_ok = False
    if not tpl.allow_airport_change and fare.airport_change:
        itinerary_ok = False
    if not tpl.allow_overnight_layover and fare.overnight_layover:
        itinerary_ok = False
    gates["itinerary_sanity"] = itinerary_ok
    if not itinerary_ok:
        return None

    # Gate 3: marketability (soft — informs score)
    min_abs = _eff(tpl, zone, "min_abs_savings_eur") or 0
    marketable = (abs_savings >= min_abs) or under_psych
    gates["marketability"] = bool(marketable)

    # Component sub-scores (0..1)
    s_anom = min(1.0, discount / 0.5) if discount > 0 else (0.4 if under_price or under_psych else 0.0)
    s_itin = 1.0 if fare.stops == 0 else (0.6 if fare.stops == 1 else 0.3)
    s_book = 1.0 if (not fare.self_transfer and not fare.mixed_cabin) else 0.4
    s_urg = 1.0 if marketable else 0.6
    score = (WEIGHTS["price_anomaly"] * s_anom + WEIGHTS["itinerary_quality"] * s_itin
             + WEIGHTS["bookability"] * s_book + WEIGHTS["urgency"] * s_urg)

    strong_anomaly = discount >= STRONG_ANOMALY_DISCOUNT or under_psych or under_price
    if score < SEND_THRESHOLD or not strong_anomaly:
        return None

    pct = round(discount * 100)
    reason = (f"€{fare.price:.0f} — {pct}% below the {baseline.sample_size}-day median "
              f"(€{baseline.median:.0f}); {'nonstop' if fare.stops == 0 else f'{fare.stops} stop(s)'}.")
    return MatchResult(match_score=round(score, 3), reason_text=reason, gate_results=gates)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_matching.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/matching.py tests/skrendam/test_matching.py
git commit -m "feat(skrendam): per-template gates + weighted match score"
```

---

## Task 10: Content draft builder

**Files:**
- Create: `skrendam/scanning/content.py`
- Test: `tests/skrendam/test_content.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_content.py
from datetime import date

from skrendam.db import models
from skrendam.scanning.content import build_content_draft


def test_fills_templates_with_fare_facts():
    tpl = models.DealTemplate(
        slug="x", name="x", trip_type="oneway",
        suggested_headline_template="{origin}→{destination} just €{price} (usually €{baseline})",
        tiktok_hook_template="POV: you leave {origin} for €{price} 👀",
        content_angle="Leave this weekend")
    draft = build_content_draft(origin="VNO", destination="BCN", price=30, baseline=49,
                                travel_date=date(2026, 7, 29), template=tpl)
    assert draft["headline"] == "VNO→BCN just €30 (usually €49)"
    assert "€30" in draft["tiktok_hook"]
    assert draft["created_by"] == "system"


def test_missing_templates_fall_back_to_generic_headline():
    tpl = models.DealTemplate(slug="x", name="x", trip_type="oneway")
    draft = build_content_draft(origin="KUN", destination="AGP", price=25, baseline=60,
                                travel_date=date(2026, 7, 12), template=tpl)
    assert "KUN" in draft["headline"] and "25" in draft["headline"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_content.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/scanning/content.py
"""Seed editorial drafts from a template's copy patterns. Curator edits before publishing."""

from datetime import date

from skrendam.db import models


def build_content_draft(origin: str, destination: str, price: float, baseline: float | None,
                        travel_date: date, template: "models.DealTemplate") -> dict:
    fields = {"origin": origin, "destination": destination, "price": f"{price:.0f}",
              "baseline": f"{baseline:.0f}" if baseline else "", "date": travel_date.isoformat()}

    def fill(pattern: str | None) -> str | None:
        if not pattern:
            return None
        try:
            return pattern.format(**fields)
        except (KeyError, IndexError):
            return pattern

    headline = fill(template.suggested_headline_template) or (
        f"{origin}→{destination} just €{price:.0f}"
        + (f" (usually €{baseline:.0f})" if baseline else ""))
    return {
        "headline": headline,
        "tiktok_hook": fill(template.tiktok_hook_template),
        "newsletter_snippet": fill(template.content_angle),
        "body": None,
        "cta_text": None,
        "created_by": "system",
        "status": "draft",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_content.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/content.py tests/skrendam/test_content.py
git commit -m "feat(skrendam): content draft builder from template copy"
```

---

## Task 11: Repositories (DB-agnostic upserts)

**Files:**
- Create: `skrendam/db/repositories.py`
- Test: `tests/skrendam/test_repositories.py`

Upsert uses select-then-write (works on SQLite and Postgres) — no dialect-specific `ON CONFLICT`.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_repositories.py
from datetime import date, datetime

from skrendam.db import models, repositories as repo


def test_upsert_candidate_is_idempotent_and_preserves_decision(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.flush()
    fields = dict(route_id=1, origin="VNO", destination="BCN", zone="MED", trip_type="oneway",
                  travel_date=date(2026, 7, 29), return_date=None, price=30.0, currency="EUR",
                  baseline_price=49.0, discount_pct=39.0)
    key = "VNO|BCN|oneway|2026-07-29|30"
    now = datetime(2026, 6, 2)

    c1 = repo.upsert_candidate(session, key, fields, now)
    c1.status = "rejected"          # curator decision
    session.flush()

    c2 = repo.upsert_candidate(session, key, {**fields, "price": 28.0}, datetime(2026, 6, 3))
    assert c2.id == c1.id                       # same row
    assert c2.status == "rejected"              # decision preserved (no resurrection)
    assert c2.last_seen_at == datetime(2026, 6, 3)
    assert session.query(models.Candidate).count() == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_repositories.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/db/repositories.py
"""Persistence helpers. Upserts via select-then-write so they run on SQLite + Postgres."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models


def upsert_candidate(session: Session, deal_group_key: str, fields: dict,
                     now: datetime) -> models.Candidate:
    existing = session.scalar(
        select(models.Candidate).where(models.Candidate.deal_group_key == deal_group_key))
    if existing is None:
        cand = models.Candidate(deal_group_key=deal_group_key, first_seen_at=now,
                                last_seen_at=now, status="new", **fields)
        session.add(cand)
        session.flush()
        return cand
    # Re-find: refresh price/last_seen only; never touch a curator decision.
    existing.price = fields["price"]
    existing.last_seen_at = now
    if existing.status not in ("approved", "edited", "rejected"):
        existing.baseline_price = fields.get("baseline_price", existing.baseline_price)
        existing.discount_pct = fields.get("discount_pct", existing.discount_pct)
        existing.itinerary_snapshot = fields.get("itinerary_snapshot", existing.itinerary_snapshot)
    session.flush()
    return existing


def upsert_match(session: Session, candidate_id: int, template_id: int,
                 match_score: float, reason_text: str, gate_results: dict) -> models.CandidateTemplateMatch:
    existing = session.scalar(
        select(models.CandidateTemplateMatch).where(
            models.CandidateTemplateMatch.candidate_id == candidate_id,
            models.CandidateTemplateMatch.deal_template_id == template_id))
    if existing is None:
        m = models.CandidateTemplateMatch(candidate_id=candidate_id, deal_template_id=template_id,
                                          match_score=match_score, reason_text=reason_text,
                                          gate_results=gate_results)
        session.add(m)
        session.flush()
        return m
    existing.match_score = match_score
    existing.reason_text = reason_text
    existing.gate_results = gate_results
    session.flush()
    return existing


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_repositories.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/db/repositories.py tests/skrendam/test_repositories.py
git commit -m "feat(skrendam): repositories with DB-agnostic upserts"
```

---

## Task 12: Scanner orchestrator (`run_scan`)

**Files:**
- Create: `skrendam/scanning/orchestrator.py`
- Test: `tests/skrendam/test_orchestrator.py`

This wires every module together (spec §7). It's tested end-to-end with a fake backend + the real in-memory DB.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_orchestrator.py
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
        max_stops=1, suggested_headline_template="{origin}->{destination} €{price}"))
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
    # Only the anomalous cheap date (€30) triggered a tier-2 detail fetch, not all 3.
    assert session.query(models.PriceLog).count() == 3   # all calendar points logged
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/scanning/orchestrator.py
"""run_scan: the 11-step pass that wires resolver → adapter → baseline → matching → DB (spec §7)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models, repositories as repo
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.fli_adapter.pacing import CircuitBreaker
from skrendam.scanning import baseline as baseline_mod
from skrendam.scanning import content as content_mod
from skrendam.scanning import matching as matching_mod
from skrendam.scanning.dedup import deal_group_key
from skrendam.scanning.resolver import resolve

CANDIDATE_TTL_DAYS = 14
ANOMALY_MULTIPLIER = 1.0  # a date is "flagged" if price <= max(decile, threshold)


@dataclass
class ScanSummary:
    templates_scanned: int = 0
    routes_scanned: int = 0
    candidates_found: int = 0
    matches_created: int = 0
    errors: int = 0


def _flagged(points, baseline, zone):
    cut = baseline.decile
    if zone.threshold_price_eur is not None:
        cut = max(cut, zone.threshold_price_eur)
    return [p for p in points if p.price <= cut]


def run_scan(session: Session, today: date, adapter: FliAdapter,
             scanner_version: str = "0.1.0", circuit_breaker_threshold: int = 5) -> ScanSummary:
    now = datetime(today.year, today.month, today.day)
    run = models.ScanRun(scanner_version=scanner_version, status="running")
    session.add(run)
    session.flush()
    summary = ScanSummary()
    breaker = CircuitBreaker(circuit_breaker_threshold)

    templates = list(session.scalars(
        select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True))))
    routes = list(session.scalars(select(models.Route)))
    zones = {z.zone: z for z in session.scalars(select(models.Zone))}
    route_by_pair = {(r.origin, r.destination): r for r in routes}

    aborted = False
    for tpl in templates:
        if aborted:
            break
        summary.templates_scanned += 1
        for spec in resolve(tpl, routes, today):
            summary.routes_scanned += 1
            try:
                points = adapter.search_calendar(spec)
                breaker.record_success()
            except ScanError:
                summary.errors += 1
                breaker.record_failure()
                if breaker.is_open():
                    aborted = True
                    break
                continue
            route = route_by_pair[(spec.origin, spec.destination)]
            zone = zones[route.zone]
            for p in points:
                session.add(models.PriceLog(
                    run_id=run.id, route_id=route.id, trip_type=spec.trip_type,
                    travel_date=p.travel_date, return_date=p.return_date, price=p.price,
                    currency="EUR", scanner_version=scanner_version, scanned_at=now))
            base = baseline_mod.compute_baseline(points)
            if base is None:
                continue
            for p in _flagged(points, base, zone):
                try:
                    fares = adapter.search_flights(spec.origin, spec.destination,
                                                   p.travel_date, p.return_date, spec.cabin)
                    breaker.record_success()
                except ScanError:
                    summary.errors += 1
                    breaker.record_failure()
                    if breaker.is_open():
                        aborted = True
                        break
                    continue
                if not fares:
                    continue
                fare = min(fares, key=lambda f: f.price)
                _persist_fare(session, run, route, zone, spec, p, fare, base,
                              templates, now, scanner_version, summary)
            if aborted:
                break

    _expire_stale(session, now)
    run.finished_at = now
    run.status = "failed" if aborted else "completed"
    run.templates_scanned = summary.templates_scanned
    run.routes_scanned = summary.routes_scanned
    run.candidates_found = summary.candidates_found
    run.matches_created = summary.matches_created
    run.api_calls = adapter.api_calls
    run.errors = summary.errors
    session.commit()
    return summary


def _persist_fare(session, run, route, zone, spec, point, fare, base, templates,
                  now, scanner_version, summary):
    discount = None if base.median <= 0 else round((base.median - fare.price) / base.median * 100, 1)
    key = deal_group_key(spec.origin, spec.destination, spec.trip_type,
                         point.travel_date, point.return_date, fare.price)
    fields = dict(run_id=run.id, route_id=route.id, origin=spec.origin,
                  destination=spec.destination, zone=route.zone, trip_type=spec.trip_type,
                  travel_date=point.travel_date, return_date=point.return_date,
                  price=fare.price, currency=fare.currency, baseline_price=base.median,
                  discount_pct=discount, itinerary_snapshot=fare.raw,
                  search_params={"cabin": spec.cabin}, scanner_version=scanner_version,
                  expires_at=now + timedelta(days=CANDIDATE_TTL_DAYS))
    is_new = session.scalar(
        select(models.Candidate.id).where(models.Candidate.deal_group_key == key)) is None
    cand = repo.upsert_candidate(session, key, fields, now)
    if is_new:
        summary.candidates_found += 1

    # Evaluate this fare against EVERY applicable template (not just the one that fetched it).
    for tpl in templates:
        if tpl.trip_type != spec.trip_type:
            continue
        if not _fare_in_template_scope(tpl, route, point, today=now.date()):
            continue
        result = matching_mod.match(fare, tpl, base, zone)
        if result is None:
            continue
        repo.upsert_match(session, cand.id, tpl.id, result.match_score,
                          result.reason_text, result.gate_results)
        summary.matches_created += 1
        draft = content_mod.build_content_draft(spec.origin, spec.destination, fare.price,
                                                base.median, point.travel_date, tpl)
        repo.ensure_content_draft(session, cand.id, tpl.id, draft)


def _fare_in_template_scope(tpl, route, point, today) -> bool:
    from skrendam.scanning.resolver import _destinations_ok, _window
    if not _destinations_ok(tpl, route):
        return False
    start, end = _window(tpl, today)
    return start <= point.travel_date <= end


def _expire_stale(session, now):
    stale = session.scalars(
        select(models.Candidate).where(
            models.Candidate.status.in_(("new", "seen", "maybe")),
            models.Candidate.expires_at.is_not(None),
            models.Candidate.expires_at < now))
    for c in stale:
        c.status = "expired"
    session.flush()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -v`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `uv run pytest tests/skrendam/ -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add skrendam/scanning/orchestrator.py tests/skrendam/test_orchestrator.py
git commit -m "feat(skrendam): scanner orchestrator run_scan (11-step pass)"
```

---

## Task 13: Verification recheck

**Files:**
- Create: `skrendam/verification.py`
- Test: `tests/skrendam/test_verification.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_verification.py
from datetime import date, datetime

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.verification import recheck_candidate


class FakeBackend:
    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{"price": 32.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "booking_url": "https://x"}]


def test_recheck_appends_check_and_sets_verified_at(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(id=1, route_id=1, origin="VNO", destination="BCN", zone="MED",
                            trip_type="oneway", travel_date=date(2026, 7, 29), price=30,
                            deal_group_key="k", first_seen_at=datetime(2026, 6, 2),
                            last_seen_at=datetime(2026, 6, 2))
    session.add(cand)
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)

    check = recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    assert check.available is True and check.price == 32.0
    assert cand.verified_at == datetime(2026, 6, 3)
    assert session.query(models.VerificationCheck).count() == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_verification.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/verification.py
"""Re-confirm a candidate is still live before publishing (spec §6 verification_checks)."""

from datetime import datetime

from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError


def recheck_candidate(session: Session, candidate: models.Candidate, adapter: FliAdapter,
                      now: datetime) -> models.VerificationCheck:
    available, price, currency, booking_url, notes, raw = False, None, None, None, None, None
    try:
        fares = adapter.search_flights(candidate.origin, candidate.destination,
                                       candidate.travel_date, candidate.return_date, "ECONOMY")
        if fares:
            fare = min(fares, key=lambda f: f.price)
            available, price, currency = True, fare.price, fare.currency
            booking_url, raw = fare.booking_url, fare.raw
        else:
            notes = "no fares returned"
    except ScanError as exc:
        notes = f"recheck failed: {exc}"

    check = models.VerificationCheck(candidate_id=candidate.id, checked_at=now, provider="fli",
                                     price=price, currency=currency, booking_url=booking_url,
                                     available=available, notes=notes, raw_snapshot=raw)
    session.add(check)
    if available:
        candidate.verified_at = now
        candidate.price = price
        candidate.last_seen_at = now
    session.commit()
    return check
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_verification.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/verification.py tests/skrendam/test_verification.py
git commit -m "feat(skrendam): candidate recheck / verification"
```

---

## Task 14: Seed data

**Files:**
- Create: `skrendam/seeds.py`
- Test: `tests/skrendam/test_seeds.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_seeds.py
from skrendam.db import models
from skrendam.seeds import seed_all


def test_seed_is_idempotent(session):
    seed_all(session)
    seed_all(session)  # second run must not duplicate
    assert session.query(models.Zone).count() >= 4
    assert session.query(models.Route).count() >= 10
    assert session.query(models.AudienceSegment).count() == 5
    assert session.query(models.TravelMoment).count() == 6
    assert session.query(models.DealTemplate).count() == 6
    # every template references a real audience + moment
    for t in session.query(models.DealTemplate):
        assert t.audience_segment_id and t.travel_moment_id
        assert t.trip_type in ("oneway", "roundtrip")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_seeds.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/seeds.py
"""Idempotent seed of starter config (spec §12). Destinations are a starter set; expand in admin."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models

ZONES = [
    ("WESTERN_EUROPE", "short", 50, 25, 25),
    ("MEDITERRANEAN", "short", 60, 30, 25),
    ("SCANDINAVIA", "short", 50, 25, 25),
    ("CANARIES", "medium", 110, 50, 30),
    ("CITY_BREAKS", "short", 45, 20, 25),
    ("LONG_HAUL", "long", 350, 150, 30),
]

# (origin, destination, zone) — starter set across VNO/KUN/RIX; expand later in admin.
ROUTES = [
    ("VNO", "BCN", "MEDITERRANEAN"), ("VNO", "AGP", "MEDITERRANEAN"),
    ("VNO", "STN", "CITY_BREAKS"), ("VNO", "CPH", "SCANDINAVIA"),
    ("VNO", "VIE", "CITY_BREAKS"), ("VNO", "LCA", "MEDITERRANEAN"),
    ("KUN", "AGP", "MEDITERRANEAN"), ("KUN", "BGY", "CITY_BREAKS"),
    ("KUN", "STN", "CITY_BREAKS"), ("KUN", "CIA", "CITY_BREAKS"),
    ("RIX", "TFS", "CANARIES"), ("RIX", "AYT", "MEDITERRANEAN"),
    ("RIX", "BCN", "MEDITERRANEAN"), ("RIX", "PRG", "CITY_BREAKS"),
]

AUDIENCES = [
    ("families", "Families", "strict"),
    ("couples", "Couples", "normal"),
    ("flexible_adults", "Flexible adults", "relaxed"),
    ("budget", "Budget travelers", "relaxed"),
    ("city_break", "City-break travelers", "normal"),
]

MOMENTS = [
    ("school_holidays", "School holidays", "seasonal", "School-holiday sun without package prices"),
    ("sept_shoulder", "September shoulder", "seasonal", "Still warm, fewer families, cheaper"),
    ("last_warm_days", "Last warm days", "seasonal", "One last sun trip before winter"),
    ("xmas_markets", "Christmas markets", "fixed_dates", "Cheap Christmas-market weekends"),
    ("last_minute", "Last-minute weekends", "relative", "Leave this weekend"),
    ("plan_ahead_summer", "Plan-ahead summer", "relative", "Book summer early when the fare is good"),
]


def _get_or_create(session, model, defaults, **key):
    obj = session.scalar(select(model).filter_by(**key))
    if obj:
        return obj
    obj = model(**key, **defaults)
    session.add(obj)
    session.flush()
    return obj


def seed_all(session: Session) -> None:
    for zone, haul, thr, mas, mdp in ZONES:
        _get_or_create(session, models.Zone, dict(haul_type=haul, threshold_price_eur=thr,
                       min_abs_savings_eur=mas, min_discount_pct=mdp), zone=zone)
    for o, d, z in ROUTES:
        _get_or_create(session, models.Route, dict(zone=z, enabled=True), origin=o, destination=d)
    aud = {s: _get_or_create(session, models.AudienceSegment,
           dict(name=n, default_itinerary_tolerance=t), slug=s) for s, n, t in AUDIENCES}
    mom = {s: _get_or_create(session, models.TravelMoment,
           dict(name=n, moment_type=mt, default_content_angle=ca), slug=s)
           for s, n, mt, ca in MOMENTS}

    templates = [
        dict(slug="family-school-holiday-sun", name="Family school-holiday sun",
             audience="families", moment="school_holidays", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="06-01", season_end_mmdd="08-31",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=7, trip_len_max_days=14,
             max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
             family_friendly_times_only=True, max_price_eur=400, min_discount_pct=20,
             public_label="Family sun", newsletter_tag="family_sun",
             suggested_headline_template="{origin}→{destination} €{price} return — school-holiday sun",
             content_angle="School-holiday sun without package prices"),
        dict(slug="september-sun", name="September sun, fewer crowds",
             audience="couples", moment="sept_shoulder", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="09-01", season_end_mmdd="09-30",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=3, trip_len_max_days=7,
             max_stops=1, min_discount_pct=25, public_label="September sun",
             newsletter_tag="sept_sun", content_angle="Still warm, fewer families, cheaper"),
        dict(slug="last-warm-days", name="Last warm days",
             audience="flexible_adults", moment="last_warm_days", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="10-01", season_end_mmdd="11-30",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=3, trip_len_max_days=10,
             max_stops=1, max_price_eur=150, min_discount_pct=25, public_label="Last warm days",
             newsletter_tag="last_warm", content_angle="One last sun trip before winter"),
        dict(slug="christmas-markets", name="Christmas markets",
             audience="city_break", moment="xmas_markets", trip_type="roundtrip",
             date_window_type="fixed", included_zones=["CITY_BREAKS", "WESTERN_EUROPE"],
             trip_len_min_days=2, trip_len_max_days=4, max_stops=1, prefer_direct=True,
             public_label="Christmas markets", newsletter_tag="xmas",
             content_angle="Cheap Christmas-market weekends"),
        dict(slug="last-minute-weekends", name="Last-minute long weekends",
             audience="budget", moment="last_minute", trip_type="oneway",
             date_window_type="relative", rel_offset_start_days=3, rel_offset_end_days=21,
             included_zones=["CITY_BREAKS", "WESTERN_EUROPE"], preferred_departure_days=["FRI", "SAT"],
             psychological_price_threshold_eur=40, allow_smaller_discount_if_under_price=True,
             max_stops=1, public_label="Leave this weekend", newsletter_tag="last_minute",
             suggested_headline_template="{origin}→{destination} just €{price} — leave this weekend",
             content_angle="Leave this weekend"),
        dict(slug="plan-ahead-summer", name="Plan-ahead summer",
             audience="families", moment="plan_ahead_summer", trip_type="roundtrip",
             date_window_type="relative", rel_offset_start_days=60, rel_offset_end_days=180,
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=7, trip_len_max_days=14,
             max_stops=1, min_discount_pct=30, public_label="Plan-ahead summer",
             newsletter_tag="plan_summer", content_angle="Book summer early when the fare is good"),
    ]
    for t in templates:
        a, m = aud[t.pop("audience")], mom[t.pop("moment")]
        _get_or_create(session, models.DealTemplate,
                       dict(audience_segment_id=a.id, travel_moment_id=m.id, enabled=True, **t),
                       slug=t.pop("slug"))
    session.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_seeds.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/seeds.py tests/skrendam/test_seeds.py
git commit -m "feat(skrendam): idempotent seed data (zones, routes, audiences, moments, templates)"
```

---

## Task 15: Live `fli` backend + CLI + scheduler

**Files:**
- Create: `skrendam/fli_adapter/live_backend.py`, `skrendam/cli.py`, `skrendam/scheduler.py`
- Modify: `pyproject.toml` (console scripts)
- Test: `tests/skrendam/test_cli.py`

The live backend is the real `fli` wiring. It is **not** unit-tested against the network (covered by the optional E2E in Task 16); the CLI wiring is tested with the fake backend.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_cli.py
from datetime import date

from skrendam.cli import run_scan_command
from skrendam.db import models


class FakeBackend:
    def search_calendar(self, spec):
        return [(date(2026, 7, 29), None, 30.0)]
    def search_flights(self, o, d, td, rd, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "booking_url": "https://x"}]


def test_run_scan_command_seeds_and_scans(session):
    summary = run_scan_command(session_factory=lambda: session, backend=FakeBackend(),
                               today=date(2026, 6, 2), seed=True)
    assert summary.templates_scanned == 6
    assert session.query(models.Candidate).count() >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_cli.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the live backend**

```python
# skrendam/fli_adapter/live_backend.py
"""Real fli wiring. The only place that builds fli filter objects + calls the network."""

from datetime import date, timedelta

from skrendam.config import Settings
from skrendam.scanning.types import SearchSpec


class LiveFliBackend:
    """Adapts fli's SearchDates/SearchFlights to the (calendar, flights) interface."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings()

    def search_calendar(self, spec: SearchSpec):
        from fli.models import (Airport, DateSearchFilters, FlightSegment, PassengerInfo,
                                 TripType)
        from fli.search import SearchDates
        seg = FlightSegment(
            departure_airport=[[getattr(Airport, spec.origin), 0]],
            arrival_airport=[[getattr(Airport, spec.destination), 0]],
            travel_date=spec.window_start.strftime("%Y-%m-%d"))
        filters = DateSearchFilters(
            trip_type=TripType.ROUND_TRIP if spec.trip_type == "roundtrip" else TripType.ONE_WAY,
            passenger_info=PassengerInfo(adults=1), flight_segments=[seg],
            from_date=spec.window_start.strftime("%Y-%m-%d"),
            to_date=spec.window_end.strftime("%Y-%m-%d"),
            duration=spec.duration_days if spec.trip_type == "roundtrip" else None)
        results = SearchDates().search(filters, currency=self.settings.currency,
                                       language=self.settings.language,
                                       country=self.settings.country) or []
        out = []
        for r in results:
            td = r.date[0].date() if hasattr(r.date[0], "date") else r.date[0]
            rd = None
            if spec.duration_days:
                rd = td + timedelta(days=spec.duration_days)
            out.append((td, rd, float(r.price)))
        return out

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        from fli.models import (Airport, FlightSearchFilters, FlightSegment, MaxStops,
                                 PassengerInfo, SeatType, SortBy, TripType)
        from fli.search import SearchFlights
        segs = [FlightSegment(departure_airport=[[getattr(Airport, origin), 0]],
                              arrival_airport=[[getattr(Airport, destination), 0]],
                              travel_date=travel_date.strftime("%Y-%m-%d"))]
        trip = TripType.ONE_WAY
        if return_date is not None:
            trip = TripType.ROUND_TRIP
            segs.append(FlightSegment(departure_airport=[[getattr(Airport, destination), 0]],
                                      arrival_airport=[[getattr(Airport, origin), 0]],
                                      travel_date=return_date.strftime("%Y-%m-%d")))
        filters = FlightSearchFilters(trip_type=trip, passenger_info=PassengerInfo(adults=1),
                                      flight_segments=segs, stops=MaxStops.ANY,
                                      seat_type=SeatType.ECONOMY, sort_by=SortBy.CHEAPEST)
        client = SearchFlights()
        results = client.search(filters, currency=self.settings.currency,
                                language=self.settings.language, country=self.settings.country) or []
        out = []
        for f in results:
            flight = f[0] if isinstance(f, tuple) else f
            out.append({
                "price": flight.price, "currency": getattr(flight, "currency", "EUR") or "EUR",
                "stops": len(flight.legs) - 1,
                "duration": sum(getattr(leg, "duration", 0) for leg in flight.legs),
                "legs": [{"airline": {"code": getattr(leg.airline, "name", str(leg.airline))},
                          "flight_number": leg.flight_number} for leg in flight.legs],
                "self_transfer": getattr(flight, "self_transfer", False),
                "mixed_cabin": getattr(flight, "mixed_cabin", False),
                "booking_url": client.build_flight_booking_url(
                    f, currency=self.settings.currency) if hasattr(client, "build_flight_booking_url") else None,
            })
        return out
```

- [ ] **Step 4: Write the CLI + scheduler**

```python
# skrendam/cli.py
"""Entrypoints: run-scan, calibrate, seed. Backend/session injectable for tests."""

import argparse
from datetime import date

from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.pacing import TokenBucket
from skrendam.scanning.orchestrator import ScanSummary, run_scan
from skrendam.seeds import seed_all


def _real_backend():
    from skrendam.fli_adapter.live_backend import LiveFliBackend
    return LiveFliBackend()


def run_scan_command(session_factory=None, backend=None, today=None, seed=False) -> ScanSummary:
    settings = Settings()
    session = (session_factory or make_sessionmaker(settings))()
    backend = backend or _real_backend()
    today = today or date.today()
    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)
    adapter = FliAdapter(backend, pace=bucket.acquire)
    if seed:
        seed_all(session)
    return run_scan(session, today=today, adapter=adapter,
                    scanner_version=settings.scanner_version)


def main():
    parser = argparse.ArgumentParser(prog="skrendam")
    sub = parser.add_subparsers(dest="cmd", required=True)
    rs = sub.add_parser("run-scan")
    rs.add_argument("--seed", action="store_true")
    sub.add_parser("seed")
    sub.add_parser("calibrate")
    args = parser.parse_args()

    if args.cmd == "run-scan":
        s = run_scan_command(seed=args.seed)
        print(f"scan complete: {s.candidates_found} candidates, {s.matches_created} matches, "
              f"{s.errors} errors")
    elif args.cmd == "seed":
        session = make_sessionmaker()()
        seed_all(session)
        print("seeded")
    elif args.cmd == "calibrate":
        from skrendam.calibrate import calibrate
        calibrate()


if __name__ == "__main__":
    main()
```

```python
# skrendam/scheduler.py
"""Warm, long-lived worker: run a scan once a day. Process stays up so calls stay warm."""

from apscheduler.schedulers.blocking import BlockingScheduler

from skrendam.cli import run_scan_command


def start():
    scheduler = BlockingScheduler(timezone="Europe/Vilnius")
    scheduler.add_job(run_scan_command, "cron", hour=6, minute=0, id="daily-scan")
    scheduler.start()


if __name__ == "__main__":
    start()
```

In `pyproject.toml` `[project.scripts]` add:

```toml
skrendam = "skrendam.cli:main"
skrendam-scheduler = "skrendam.scheduler:start"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_cli.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add skrendam/fli_adapter/live_backend.py skrendam/cli.py skrendam/scheduler.py pyproject.toml tests/skrendam/test_cli.py
git commit -m "feat(skrendam): live fli backend, CLI, daily scheduler"
```

---

## Task 16: Calibration + live E2E smoke test + tuning

**Files:**
- Create: `skrendam/calibrate.py`
- Test: `tests/skrendam/test_calibrate.py`, `tests/skrendam/test_e2e_live.py`

- [ ] **Step 1: Write the failing test (calibration, offline)**

```python
# tests/skrendam/test_calibrate.py
from datetime import date

from skrendam.calibrate import calibrate_thresholds
from skrendam.db import models


class FakeBackend:
    def search_calendar(self, spec):
        return [(date(2026, 7, 1 + i), None, 40 + i * 5) for i in range(10)]
    def search_flights(self, *a, **k):
        return []


def test_calibration_sets_zone_thresholds_from_observed_fares(session):
    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED", enabled=True))
    session.commit()
    calibrate_thresholds(session, backend=FakeBackend(), today=date(2026, 6, 2))
    z = session.query(models.Zone).one()
    assert z.threshold_price_eur is not None and z.threshold_price_eur > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_calibrate.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```python
# skrendam/calibrate.py
"""Seed each zone's thresholds from a real broad scan (spec §12). Re-runnable."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.pacing import TokenBucket
from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.types import SearchSpec
from skrendam.db import models


def calibrate_thresholds(session: Session, backend, today: date) -> None:
    routes = list(session.scalars(select(models.Route).where(models.Route.enabled.is_(True))))
    adapter = FliAdapter(backend, pace=lambda: None)
    by_zone: dict[str, list[float]] = {}
    for r in routes:
        spec = SearchSpec(r.origin, r.destination, "oneway", today + timedelta(days=14),
                          today + timedelta(days=120), None, r.cabin or "ECONOMY")
        points = adapter.search_calendar(spec)
        base = compute_baseline(points)
        if base:
            by_zone.setdefault(r.zone, []).append(base.decile)
    for zone, deciles in by_zone.items():
        z = session.get(models.Zone, zone)
        if z and deciles:
            # "interesting" ceiling = the typical cheap-end price across the zone's routes.
            z.threshold_price_eur = round(sum(deciles) / len(deciles), 0)
    session.commit()


def calibrate() -> None:
    from skrendam.fli_adapter.live_backend import LiveFliBackend
    settings = Settings()
    session = make_sessionmaker(settings)()
    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)
    backend = LiveFliBackend(settings)
    # Pace the live calibration scan by wrapping the adapter inside calibrate_thresholds:
    calibrate_thresholds(session, backend=_PacedBackend(backend, bucket), today=date.today())


class _PacedBackend:
    def __init__(self, inner, bucket):
        self.inner, self.bucket = inner, bucket
    def search_calendar(self, spec):
        self.bucket.acquire()
        return self.inner.search_calendar(spec)
    def search_flights(self, *a, **k):
        self.bucket.acquire()
        return self.inner.search_flights(*a, **k)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_calibrate.py -v`
Expected: PASS.

- [ ] **Step 5: Write the optional live E2E smoke test (gated)**

```python
# tests/skrendam/test_e2e_live.py
import os
from datetime import date, timedelta

import pytest

from skrendam.fli_adapter.live_backend import LiveFliBackend
from skrendam.scanning.types import SearchSpec

pytestmark = pytest.mark.skipif(os.getenv("FLI_E2E") != "1",
                                reason="live API test; set FLI_E2E=1 to run")


def test_live_calendar_returns_real_prices():
    backend = LiveFliBackend()
    start = date.today() + timedelta(days=30)
    spec = SearchSpec("VNO", "BCN", "oneway", start, start + timedelta(days=45), None, "ECONOMY")
    rows = backend.search_calendar(spec)
    assert rows and all(p > 0 for (_, _, p) in rows)
```

- [ ] **Step 6: Run the offline suite, then (optionally) the live smoke**

Run: `uv run pytest tests/skrendam/ -v` → all PASS (live test skipped).
Optional manual check: `FLI_E2E=1 uv run pytest tests/skrendam/test_e2e_live.py -v` → PASS with real prices.

- [ ] **Step 7: Real dry run + tune**

Run against a real (throwaway) Postgres or local SQLite:
```bash
SKRENDAM_DATABASE_URL="sqlite:///dryrun.db" uv run alembic upgrade head
SKRENDAM_DATABASE_URL="sqlite:///dryrun.db" uv run skrendam calibrate
SKRENDAM_DATABASE_URL="sqlite:///dryrun.db" uv run skrendam run-scan --seed
```
Inspect `candidates` / `candidate_template_matches`. If too few/many candidates, adjust `SEND_THRESHOLD`/`STRONG_ANOMALY_DISCOUNT` in `matching.py` and zone thresholds, then re-run. Commit any tuning.

- [ ] **Step 8: Commit**

```bash
git add skrendam/calibrate.py tests/skrendam/test_calibrate.py tests/skrendam/test_e2e_live.py
git commit -m "feat(skrendam): calibration script + gated live E2E smoke test"
```

---

## Definition of done

- `uv run pytest tests/skrendam/ -v` is green.
- `uv run skrendam run-scan --seed` populates `scan_runs`, `price_log`, `candidates`, `candidate_template_matches`, and `content_drafts`.
- A real dry run produces a believable set of candidates for VNO/KUN/RIX across the 6 seeded templates, with no sustained 429s.
- Alembic `check` reports no model drift.
- The schema is ready for Plan 2 (the Next.js curator admin) to introspect via `drizzle-kit pull`.
