# fli-dependency resilience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the engine distinguish "quiet market" from "broken pipe": record per-call outcomes at the fli adapter seam, judge each scan with a pure health verdict (`ScanRun.status="degraded"` + `health` JSON), stop empty rechecks from expiring live deals (`unverified_since` instead), add the missing date-based published-deal expiry, replace string-matched error classification with typed checks, surface health in CLI exit codes / worker results / a Deal Desk banner, and stand up the daily-scan cadence (launchd) plus an upstream-watch doc.

**Architecture:** New pure module `skrendam/fli_adapter/health.py` (`CallRecord`/`CallLog`/`HealthVerdict`/`assess`/`health_json`). `FliAdapter` records one outcome per network call. The orchestrator stamps the verdict and runs a date-expiry sweep; `verification.py` never expires on empty. Additive migration 0007 (`scan_runs.health`, `published_deals.unverified_since`). Web reads the new columns after a Drizzle re-pull.

**Tech Stack:** Python 3.10+, SQLAlchemy 2.0, Alembic, pytest (`uv run`); Drizzle + Neon Postgres, Vitest for web; bash + launchd for cadence.

**Spec:** `docs/superpowers/specs/2026-06-11-fli-resilience-design.md`

---

## File Structure

**Create:**
- `skrendam/fli_adapter/health.py` — CallRecord, CallLog, HealthVerdict, assess(), health_json()
- `alembic/versions/0007_fli_resilience.py` — additive migration
- `tests/skrendam/test_health.py`
- `scripts/daily-scan.sh`, `scripts/launchd/com.skrendam.daily-scan.plist`, `scripts/install-daily-scan.sh`
- `docs/ops/daily-scan.md`, `docs/ops/upstream-watch.md`
- `web/src/components/ScanHealthBanner.tsx`

**Modify:**
- `skrendam/fli_adapter/adapter.py` — typed `_classify`, call_log recording
- `skrendam/db/models.py` — `ScanRun.health`, `PublishedDeal.unverified_since`
- `skrendam/scanning/orchestrator.py` — verdict stamping, `ScanSummary.health`, expiry sweep
- `skrendam/verification.py` — never-expire-on-empty + unverified_since
- `skrendam/cli.py` — degraded warning + exit code 2
- `skrendam/worker.py` — health in `result_summary`
- `CONTEXT.md` — Scan health vocabulary
- `tests/skrendam/{test_adapter,test_orchestrator,test_verification_published,test_cli,test_worker}.py`
- web: `src/lib/types.ts`, `src/lib/mappers.ts`, `src/app/(app)/page.tsx`, `src/components/PublishedBoard.tsx`, `src/app/globals.css`, `src/lib/mappers.test.ts`

---

## Stage 0 — Vocabulary

### Task 0: CONTEXT.md scan-health vocabulary

**Files:**
- Modify: `CONTEXT.md` (append a new section)

- [ ] **Step 1: Append this section to CONTEXT.md**

```markdown
## Scan health

- **CallRecord / CallLog** — one record per *network* call the fli adapter makes (cache hits
  excluded): kind (`calendar`/`flights`), route, trip_type, outcome, rows; errors carry the
  classified kind + truncated message. Lives on the adapter for one run.
- **outcome** — `data` (succeeded, non-empty) | `empty` (succeeded, zero rows) | `error` (raised).
  Distinguishing `empty` from `data` at the seam is what makes silent fli breakage visible.
- **HealthVerdict** — pure judgment over a CallLog: `healthy`/`degraded` + reasons + metrics.
  Computed by `skrendam/fli_adapter/health.py: assess()`; bars are in-module constants.
- **degraded** — a `scan_runs.status` value: the run finished and its data was committed, but the
  results should not be trusted as a picture of the market. `failed` (breaker) takes precedence.
- **unverified_since** — nullable timestamp on `published_deals`: live, but the engine couldn't
  confirm it since this time. Set by an empty recheck, cleared by a successful one. Empty rechecks
  NEVER expire deals — expiry is date-based (the sweep) or human.
- **expiry sweep** — end-of-scan housekeeping expiring live published deals whose `valid_until` or
  `travel_date` has passed. Pure calendar logic; works identically during an fli outage.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(skrendam): CONTEXT.md scan-health vocabulary"
```

---

## Stage 1 — Pure health module

### Task 1: health.py — CallLog + assess()

**Files:**
- Create: `skrendam/fli_adapter/health.py`
- Test: `tests/skrendam/test_health.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_health.py
from skrendam.fli_adapter.health import ERROR_DETAIL_CAP, CallLog, assess, health_json


def _log(calendar_data=0, calendar_empty=0, flights_data=0, flights_empty=0, errors=0):
    log = CallLog()
    for _ in range(calendar_data):
        log.record("calendar", "VNO-BCN", "oneway", "data", rows=30)
    for _ in range(calendar_empty):
        log.record("calendar", "VNO-BCN", "oneway", "empty")
    for _ in range(flights_data):
        log.record("flights", "VNO-BCN", "oneway", "data", rows=5)
    for _ in range(flights_empty):
        log.record("flights", "VNO-BCN", "oneway", "empty")
    for i in range(errors):
        log.record("calendar", "VNO-BCN", "oneway", "error",
                   error_kind="TimeoutError_", error_msg=f"boom {i}")
    return log


def test_healthy_run_passes():
    v = assess(_log(calendar_data=40, flights_data=20), price_rows=1850, prior_price_rows=1846)
    assert v.status == "healthy" and v.reasons == [] and not v.degraded


def test_empty_ratio_trips():
    v = assess(_log(calendar_data=3, calendar_empty=5), price_rows=90)
    assert v.degraded
    assert "5/8 calendar searches" in v.reasons[0]


def test_empty_ratio_needs_min_sample():
    v = assess(_log(calendar_empty=4), price_rows=0)  # 4 calls < MIN_CALENDAR_SAMPLE and < floor
    assert v.status == "healthy"


def test_no_data_floor_trips():
    v = assess(_log(calendar_empty=2, flights_empty=8), price_rows=0)  # 10 calls, 0 rows
    assert v.degraded
    assert any("0 price rows" in r for r in v.reasons)


def test_cliff_vs_prior_run():
    v = assess(_log(calendar_data=40), price_rows=12, prior_price_rows=1846)
    assert v.degraded
    assert any("cliff" in r for r in v.reasons)


def test_cliff_needs_meaningful_prior():
    v = assess(_log(calendar_data=4), price_rows=3, prior_price_rows=50)  # prior < 100
    assert v.status == "healthy"


def test_health_json_caps_error_detail():
    log = _log(calendar_data=40, errors=ERROR_DETAIL_CAP + 10)
    v = assess(log, price_rows=500)
    j = health_json(v, log)
    assert len(j["errors"]) == ERROR_DETAIL_CAP
    assert j["errors"][0] == {"kind": "TimeoutError_", "call": "calendar",
                              "route": "VNO-BCN", "msg": "boom 0"}
    assert j["metrics"]["error_calls"] == ERROR_DETAIL_CAP + 10
    assert j["reasons"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_health.py -vv`
Expected: FAIL (`ModuleNotFoundError: skrendam.fli_adapter.health`)

- [ ] **Step 3: Write the module**

```python
# skrendam/fli_adapter/health.py
"""Scan health: per-call outcome capture + a pure end-of-run verdict.

The adapter records one CallRecord per network call (cache hits excluded);
assess() turns the log + price-row counts into a HealthVerdict the
orchestrator stamps onto ScanRun. A degraded run keeps its data — the status
only says how much to trust the run as a picture of the market. Bars are
in-module constants (house style, like scorer bars), tunable after observation."""

from __future__ import annotations

from dataclasses import dataclass, field

EMPTY_RATIO_BAR = 0.5       # degraded when >= this fraction of calendar calls are empty...
MIN_CALENDAR_SAMPLE = 5     # ...given at least this many calendar calls
NO_DATA_MIN_CALLS = 10      # degraded when >= this many api calls produced exactly 0 price rows
CLIFF_PRIOR_MIN_ROWS = 100  # cliff fires only when the prior run logged at least this many rows
CLIFF_FRACTION = 0.10       # ...and this run logged under this fraction of it
ERROR_DETAIL_CAP = 20       # at most this many error records are persisted in the JSON
_ERROR_MSG_MAX = 300


@dataclass(frozen=True)
class CallRecord:
    kind: str                   # "calendar" | "flights"
    route: str                  # "VNO-BCN"
    trip_type: str              # "oneway" | "roundtrip"
    outcome: str                # "data" | "empty" | "error"
    rows: int = 0
    error_kind: str | None = None
    error_msg: str | None = None


@dataclass
class CallLog:
    records: list[CallRecord] = field(default_factory=list)

    def record(self, kind: str, route: str, trip_type: str, outcome: str, rows: int = 0,
               error_kind: str | None = None, error_msg: str | None = None) -> None:
        self.records.append(CallRecord(
            kind=kind, route=route, trip_type=trip_type, outcome=outcome, rows=rows,
            error_kind=error_kind,
            error_msg=str(error_msg)[:_ERROR_MSG_MAX] if error_msg else None))

    def count(self, kind: str, outcome: str | None = None) -> int:
        return sum(1 for r in self.records
                   if r.kind == kind and (outcome is None or r.outcome == outcome))

    @property
    def errors(self) -> list[CallRecord]:
        return [r for r in self.records if r.outcome == "error"]


@dataclass(frozen=True)
class HealthVerdict:
    status: str                 # "healthy" | "degraded"
    reasons: list[str]
    metrics: dict

    @property
    def degraded(self) -> bool:
        return self.status == "degraded"


def assess(log: CallLog, price_rows: int, prior_price_rows: int | None = None) -> HealthVerdict:
    """Pure verdict over one run's call log + price-row counts."""
    reasons: list[str] = []
    cal = log.count("calendar")
    cal_empty = log.count("calendar", "empty")
    if cal >= MIN_CALENDAR_SAMPLE and cal_empty / cal >= EMPTY_RATIO_BAR:
        reasons.append(f"{cal_empty}/{cal} calendar searches returned no data")
    if len(log.records) >= NO_DATA_MIN_CALLS and price_rows == 0:
        reasons.append(f"{len(log.records)} api calls produced 0 price rows")
    if (prior_price_rows is not None and prior_price_rows >= CLIFF_PRIOR_MIN_ROWS
            and price_rows < prior_price_rows * CLIFF_FRACTION):
        reasons.append(
            f"price rows fell off a cliff: {price_rows} vs {prior_price_rows} last run")
    metrics = {
        "calendar_calls": cal, "calendar_empty": cal_empty,
        "flights_calls": log.count("flights"), "flights_empty": log.count("flights", "empty"),
        "error_calls": len(log.errors), "price_rows": price_rows,
        "prior_price_rows": prior_price_rows,
    }
    return HealthVerdict(status="degraded" if reasons else "healthy",
                         reasons=reasons, metrics=metrics)


def health_json(verdict: HealthVerdict, log: CallLog) -> dict:
    """The dict persisted to scan_runs.health."""
    return {
        "reasons": verdict.reasons,
        "metrics": verdict.metrics,
        "errors": [{"kind": r.error_kind, "call": r.kind, "route": r.route, "msg": r.error_msg}
                   for r in log.errors[:ERROR_DETAIL_CAP]],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_health.py -vv`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add skrendam/fli_adapter/health.py tests/skrendam/test_health.py
git commit -m "feat(skrendam): scan-health module — CallLog + pure assess() verdict"
```

---

### Task 2: Adapter — outcome recording + typed classification

**Files:**
- Modify: `skrendam/fli_adapter/adapter.py` (replace the whole file)
- Test: `tests/skrendam/test_adapter.py` (append)

- [ ] **Step 1: Append the failing tests**

```python
# append to tests/skrendam/test_adapter.py
import pytest

from fli.search.exceptions import SearchConnectionError, SearchHTTPError, SearchTimeoutError
from skrendam.fli_adapter.adapter import _classify
from skrendam.fli_adapter.errors import (
    ConnectionError_ as SkConnectionError,
    RateLimitedError as SkRateLimited,
    ScanError,
    TimeoutError_ as SkTimeout,
)


class _EmptyBackend(FakeBackend):
    def search_calendar(self, spec):
        return []

    def search_flights(self, *a, **k):
        return []


def test_call_log_records_data_and_skips_cache_hits():
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    adapter.search_calendar(_spec())
    adapter.search_calendar(_spec())  # cache hit -> no record
    assert [(r.kind, r.outcome, r.rows) for r in adapter.call_log.records] == [
        ("calendar", "data", 2)]


def test_call_log_records_empty_outcomes():
    adapter = FliAdapter(_EmptyBackend(), pace=lambda: None)
    adapter.search_calendar(_spec())
    adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    assert [(r.kind, r.outcome) for r in adapter.call_log.records] == [
        ("calendar", "empty"), ("flights", "empty")]


def test_call_log_records_classified_error():
    class Boom(FakeBackend):
        def search_flights(self, *a, **k):
            raise RuntimeError("HTTP 429")

    adapter = FliAdapter(Boom(), pace=lambda: None)
    with pytest.raises(SkRateLimited):
        adapter.search_flights("VNO", "BCN", date(2026, 7, 29), None, "ECONOMY")
    (rec,) = adapter.call_log.records
    assert rec.outcome == "error"
    assert rec.error_kind == "RateLimitedError"
    assert rec.route == "VNO-BCN" and rec.kind == "flights"


def test_classify_uses_fli_typed_exceptions():
    assert isinstance(_classify(SearchHTTPError("blocked", status_code=429)), SkRateLimited)
    assert isinstance(_classify(SearchHTTPError("server", status_code=503)), ScanError)
    assert not isinstance(_classify(SearchHTTPError("server", status_code=503)), SkRateLimited)
    assert isinstance(_classify(SearchTimeoutError("slow")), SkTimeout)
    assert isinstance(_classify(SearchConnectionError("dns")), SkConnectionError)
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `uv run pytest tests/skrendam/test_adapter.py -vv`
Expected: new tests FAIL (`call_log` attribute missing; `_classify(SearchTimeoutError(...))` falls
through string matching — "slow" contains none of the keywords → plain `ScanError`, so the
isinstance assert fails)

- [ ] **Step 3: Replace adapter.py**

```python
# skrendam/fli_adapter/adapter.py
"""The only module that talks to a flight-search backend. Pure plumbing + caching."""

from collections.abc import Callable
from datetime import date

from fli.search.exceptions import (
    SearchConnectionError,
    SearchHTTPError,
    SearchTimeoutError,
)

from skrendam.fli_adapter.errors import (
    ConnectionError_,
    ParseError,
    RateLimitedError,
    ScanError,
    TimeoutError_,
)
from skrendam.fli_adapter.health import CallLog
from skrendam.scanning.types import CalendarPoint, FareItinerary, SearchSpec


def _classify(exc: Exception) -> ScanError:
    """Map a backend exception to a typed ScanError.

    fli raises a typed SearchClientError family — match on type first. The
    string heuristics remain only as a fallback for non-fli exceptions."""
    if isinstance(exc, SearchHTTPError):
        if exc.status_code == 429:
            return RateLimitedError(str(exc))
        return ScanError(f"http {exc.status_code}: {exc}")
    if isinstance(exc, SearchTimeoutError):
        return TimeoutError_(str(exc))
    if isinstance(exc, SearchConnectionError):
        return ConnectionError_(str(exc))
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
        self.call_log = CallLog()

    def search_calendar(self, spec: SearchSpec) -> list[CalendarPoint]:
        key = (spec.origin, spec.destination, spec.trip_type, spec.window_start,
               spec.window_end, spec.duration_days, spec.cabin)
        if key in self._cache:
            return self._cache[key]
        route = f"{spec.origin}-{spec.destination}"
        self._pace()
        self.api_calls += 1
        try:
            rows = self._backend.search_calendar(spec)
            points = [CalendarPoint(td, rd, float(p)) for (td, rd, p) in rows]
        except ScanError as err:
            self.call_log.record("calendar", route, spec.trip_type, "error",
                                 error_kind=type(err).__name__, error_msg=str(err))
            raise
        except Exception as exc:  # noqa: BLE001 — re-raised as typed ScanError
            err = _classify(exc)
            self.call_log.record("calendar", route, spec.trip_type, "error",
                                 error_kind=type(err).__name__, error_msg=str(exc))
            raise err from exc
        self.call_log.record("calendar", route, spec.trip_type,
                             "data" if points else "empty", rows=len(points))
        self._cache[key] = points
        return points

    def search_flights(self, origin: str, destination: str, travel_date: date,
                       return_date: date | None, cabin: str) -> list[FareItinerary]:
        route = f"{origin}-{destination}"
        trip_type = "roundtrip" if return_date is not None else "oneway"
        self._pace()
        self.api_calls += 1
        try:
            raw = self._backend.search_flights(origin, destination, travel_date,
                                               return_date, cabin)
            fares = [self._to_itinerary(r) for r in raw]
        except ScanError as err:  # e.g. ParseError from _to_itinerary
            self.call_log.record("flights", route, trip_type, "error",
                                 error_kind=type(err).__name__, error_msg=str(err))
            raise
        except Exception as exc:  # noqa: BLE001
            err = _classify(exc)
            self.call_log.record("flights", route, trip_type, "error",
                                 error_kind=type(err).__name__, error_msg=str(exc))
            raise err from exc
        self.call_log.record("flights", route, trip_type,
                             "data" if fares else "empty", rows=len(fares))
        return fares

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

- [ ] **Step 4: Run the adapter tests**

Run: `uv run pytest tests/skrendam/test_adapter.py -vv`
Expected: PASS (old + new). The pre-existing `test_backend_error_is_wrapped` still passes via the
string fallback (`RuntimeError("HTTP 429")` is not a fli exception).

- [ ] **Step 5: Run the full skrendam suite to catch regressions**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skrendam/fli_adapter/adapter.py tests/skrendam/test_adapter.py
git commit -m "feat(skrendam): adapter records call outcomes + typed error classification"
```

---

## Stage 2 — Schema

### Task 3: Models + migration 0007

**Files:**
- Modify: `skrendam/db/models.py`
- Create: `alembic/versions/0007_fli_resilience.py`

- [ ] **Step 1: Add the columns to the models**

In `ScanRun` (after the `status` line, models.py:132):

```python
    health: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

In `PublishedDeal` (after the `last_seen_at` line, models.py:260):

```python
    unverified_since: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

(`JSON`, `DateTime`, `datetime` are already imported in models.py.)

- [ ] **Step 2: Verify the schema builds**

Run: `uv run python -c "from skrendam.db.base import Base; from skrendam.db import models; from sqlalchemy import create_engine; Base.metadata.create_all(create_engine('sqlite://')); print('ok')"`
Expected: `ok`

- [ ] **Step 3: Confirm the current alembic head**

Run: `uv run alembic heads`
Expected: `0006_multi_strategy_scoring (head)`. If it differs, use the printed value as
`down_revision` below.

- [ ] **Step 4: Write the migration**

```python
# alembic/versions/0007_fli_resilience.py
"""fli resilience: scan_runs.health, published_deals.unverified_since

Revision ID: 0007_fli_resilience
Revises: 0006_multi_strategy_scoring
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_fli_resilience"
down_revision = "0006_multi_strategy_scoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scan_runs", sa.Column("health", sa.JSON(), nullable=True))
    op.add_column("published_deals", sa.Column("unverified_since", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("published_deals", "unverified_since")
    op.drop_column("scan_runs", "health")
```

- [ ] **Step 5: Verify the migration applies and downgrades on scratch SQLite**

```bash
SKRENDAM_DATABASE_URL="sqlite:///./_scratch_migration.db" uv run alembic upgrade head && \
SKRENDAM_DATABASE_URL="sqlite:///./_scratch_migration.db" uv run alembic downgrade -1 && \
rm -f _scratch_migration.db
```
Expected: upgrade then downgrade without error.

- [ ] **Step 6: Run the model/migration tests**

Run: `uv run pytest tests/skrendam/test_models.py tests/skrendam/test_migration.py -vv`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add skrendam/db/models.py alembic/versions/0007_fli_resilience.py
git commit -m "feat(skrendam): schema — scan_runs.health + published_deals.unverified_since (0007)"
```

---

## Stage 3 — Orchestrator wiring

### Task 4: Verdict stamping + expiry sweep

**Files:**
- Modify: `skrendam/scanning/orchestrator.py`
- Test: `tests/skrendam/test_orchestrator.py` (append)

- [ ] **Step 1: Append the failing tests**

```python
# append to tests/skrendam/test_orchestrator.py

def _seed_many_routes(session, n=6):
    """Zone + template as in _seed, but n routes so health bars have a sample."""
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=60,
                            min_abs_savings_eur=20, min_discount_pct=20))
    dests = ["BCN", "AGP", "PMI", "LIS", "FAO", "ATH"][:n]
    for i, d in enumerate(dests, start=1):
        session.add(models.Route(id=i, origin="VNO", destination=d, zone="MED", enabled=True))
    session.add_all([models.AudienceSegment(id=1, slug="budget", name="Budget"),
                     models.TravelMoment(id=1, slug="lm", name="LM", moment_type="relative")])
    session.add(models.DealTemplate(
        id=1, slug="lastminute", name="Last-minute", enabled=True, audience_segment_id=1,
        travel_moment_id=1, trip_type="oneway", date_window_type="relative",
        rel_offset_start_days=1, rel_offset_end_days=60, included_zones=["MED"], max_stops=1))
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
    assert run.status == "degraded"            # 3/6 empty == EMPTY_RATIO_BAR
    assert session.query(models.PriceLog).count() == 9   # 3 data routes x 3 points
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
    session.add(models.Candidate(id=50, route_id=1, origin="VNO", destination="BCN", zone="MED",
                                 trip_type="oneway", travel_date=date(2026, 5, 1), price=30.0,
                                 deal_group_key="k50"))
    common = dict(candidate_id=50, deal_template_id=1, origin="VNO", destination="BCN",
                  trip_type="oneway", price=30.0, status="live")
    session.add_all([
        models.PublishedDeal(id=11, headline="past valid_until",
                             valid_until=date(2026, 6, 1), **common),
        models.PublishedDeal(id=12, headline="past travel",
                             travel_date=date(2026, 5, 1), **common),
        models.PublishedDeal(id=13, headline="future", valid_until=date(2026, 12, 1),
                             travel_date=date(2026, 12, 24), **common),
        models.PublishedDeal(id=14, headline="dateless", **common),
    ])
    session.commit()
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    statuses = {pd.id: pd.status
                for pd in session.query(models.PublishedDeal).filter(models.PublishedDeal.id >= 11)}
    assert statuses == {11: "expired", 12: "expired", 13: "live", 14: "live"}
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -vv`
Expected: new tests FAIL (`run.health` is None / `summary.health` attribute missing / sweep absent)

- [ ] **Step 3: Update orchestrator imports**

Replace (orchestrator.py:6):
```python
from sqlalchemy import select
```
with:
```python
from sqlalchemy import func, or_, select
```

After the `from skrendam.fli_adapter.pacing import CircuitBreaker` import, add:
```python
from skrendam.fli_adapter.health import HealthVerdict, assess, health_json
```

- [ ] **Step 4: Extend ScanSummary**

Add a field to the `ScanSummary` dataclass (after `http_429s`):
```python
    health: HealthVerdict | None = None
```

- [ ] **Step 5: Replace the end-of-run block**

Replace (orchestrator.py:110-121, from `_expire_stale(session, now)` to `return summary`):

```python
    _expire_stale(session, now)
    _expire_published_past_date(session, today)

    price_rows = session.scalar(
        select(func.count()).select_from(models.PriceLog)
        .where(models.PriceLog.run_id == run.id)) or 0
    prior_run_id = session.scalar(
        select(models.ScanRun.id)
        .where(models.ScanRun.id != run.id,
               models.ScanRun.status.in_(("completed", "degraded")))
        .order_by(models.ScanRun.id.desc()).limit(1))
    prior_rows = None
    if prior_run_id is not None:
        prior_rows = session.scalar(
            select(func.count()).select_from(models.PriceLog)
            .where(models.PriceLog.run_id == prior_run_id)) or 0
    verdict = assess(adapter.call_log, price_rows, prior_rows)
    summary.health = verdict

    run.finished_at = now
    if aborted:
        run.status = "failed"
    elif verdict.degraded:
        run.status = "degraded"
    else:
        run.status = "completed"
    run.health = health_json(verdict, adapter.call_log)
    run.templates_scanned = summary.templates_scanned
    run.routes_scanned = summary.routes_scanned
    run.candidates_found = summary.candidates_found
    run.matches_created = summary.matches_created
    run.api_calls = adapter.api_calls
    run.errors = summary.errors
    run.http_429s = summary.http_429s
    session.commit()
    return summary
```

- [ ] **Step 6: Add the sweep function (after `_expire_stale`)**

```python
def _expire_published_past_date(session, today):
    """Date-based expiry for live published deals. Pure calendar logic — works
    identically during an fli outage, which is the point: empty rechecks never
    expire deals (verification.py), so dates and humans are the only expirers.
    NULL dates drop out of the comparisons: a dateless deal stays curator-managed."""
    stale = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.status == "live",
            or_(models.PublishedDeal.valid_until < today,
                models.PublishedDeal.travel_date < today)))
    for pd in stale:
        pd.status = "expired"
    session.flush()
```

- [ ] **Step 7: Run the orchestrator tests**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -vv`
Expected: PASS (old + new). The pre-existing healthy-path test still sees `status == "completed"`
(1 calendar call is under every bar).

- [ ] **Step 8: Run the full skrendam suite**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS (`test_e2e_pipeline.py` and `test_cli.py` exercise `run_scan` with small fake
backends — all under the bars, so they stay `completed`)

- [ ] **Step 9: Commit**

```bash
git add skrendam/scanning/orchestrator.py tests/skrendam/test_orchestrator.py
git commit -m "feat(skrendam): scans get a health verdict + date-based published-deal expiry sweep"
```

---

## Stage 4 — Recheck fail-safe

### Task 5: Empty rechecks never expire; unverified_since marker

**Files:**
- Modify: `skrendam/verification.py`
- Test: `tests/skrendam/test_verification_published.py` (modify one test, append three)

- [ ] **Step 1: Replace the expires-when-gone test and append the new cases**

Replace `test_recheck_expires_when_gone` (test_verification_published.py:51-56) with:

```python
def test_recheck_empty_keeps_deal_live_and_marks_unverified(session):
    """Empty fli results must NOT expire live deals — the pipe may be gated
    (the silent-empty mode), not the fare gone."""
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)  # no fares
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)
    assert pd.last_seen_at is None  # an unverifiable check is not a sighting


def test_second_empty_recheck_keeps_first_unverified_timestamp(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 4))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)


def test_successful_recheck_clears_unverified(session):
    cand = _seed(session, price=96.0)
    recheck_candidate(session, cand, FliAdapter(_Backend([]), pace=lambda: None),
                      now=datetime(2026, 6, 3))
    recheck_candidate(session, cand, FliAdapter(_Backend(_fare(98.0)), pace=lambda: None),
                      now=datetime(2026, 6, 4))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.unverified_since is None
    assert pd.status == "live"
    assert pd.last_seen_at == datetime(2026, 6, 4)
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `uv run pytest tests/skrendam/test_verification_published.py -vv`
Expected: the three new/changed tests FAIL (deal gets expired; `unverified_since` never set)

- [ ] **Step 3: Replace `_update_published_for_candidate` in verification.py**

```python
def _update_published_for_candidate(session: Session, candidate_id: int, available: bool,
                                    price: float | None, now: datetime) -> None:
    """Propagate a recheck result to the candidate's LIVE published deals.

    An empty result NEVER expires a deal: during a gated fli window "no fares"
    usually means "blocked", not "gone" (spec: fli-resilience). Deals leave the
    site via the date sweep (orchestrator) or the curator — never via emptiness."""
    deals = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.candidate_id == candidate_id,
            models.PublishedDeal.status == "live"))
    for pd in deals:
        if not available:
            if pd.unverified_since is None:
                pd.unverified_since = now
            continue
        pd.unverified_since = None
        pd.last_seen_at = now
        if price is not None:
            pd.going_fast = price >= pd.price * (1 + GOING_FAST_RISE)
```

- [ ] **Step 4: Run the verification tests**

Run: `uv run pytest tests/skrendam/test_verification_published.py tests/skrendam/test_verification.py -vv`
Expected: PASS (going-fast and ScanError tests unchanged; `test_verification.py` covers check rows
and candidate fields, untouched by this change)

- [ ] **Step 5: Commit**

```bash
git add skrendam/verification.py tests/skrendam/test_verification_published.py
git commit -m "feat(skrendam): empty rechecks mark unverified_since instead of expiring live deals"
```

---

## Stage 5 — Surfacing (CLI + worker)

### Task 6: CLI exit code 2 + worker result health

**Files:**
- Modify: `skrendam/cli.py` (the `run-scan` branch in `main()`)
- Modify: `skrendam/worker.py` (the `full_scan` branch)
- Test: `tests/skrendam/test_cli.py`, `tests/skrendam/test_worker.py` (append)

- [ ] **Step 1: Append the failing CLI test**

```python
# append to tests/skrendam/test_cli.py
import pytest

from skrendam.fli_adapter.health import HealthVerdict
from skrendam.scanning.orchestrator import ScanSummary


def test_run_scan_cli_exits_2_on_degraded(monkeypatch, capsys):
    import skrendam.cli as cli

    summary = ScanSummary()
    summary.health = HealthVerdict(status="degraded",
                                   reasons=["6/6 calendar searches returned no data"], metrics={})
    monkeypatch.setattr(cli, "run_scan_command", lambda seed=False: summary)
    monkeypatch.setattr("sys.argv", ["skrendam", "run-scan"])
    with pytest.raises(SystemExit) as ei:
        cli.main()
    assert ei.value.code == 2
    out = capsys.readouterr().out
    assert "DEGRADED" in out and "6/6 calendar searches" in out
```

- [ ] **Step 2: Append the failing worker test**

```python
# append to tests/skrendam/test_worker.py (it already imports models/date/datetime;
# add these imports at the top of the file if missing)
from skrendam.fli_adapter.health import HealthVerdict
from skrendam.scanning.orchestrator import ScanSummary


def test_full_scan_result_summary_carries_health(session, monkeypatch):
    import skrendam.worker as worker_mod

    summary = ScanSummary()
    summary.health = HealthVerdict(status="degraded", reasons=["r1"], metrics={})
    monkeypatch.setattr(worker_mod, "run_scan", lambda *a, **k: summary)
    session.add(models.ScanRequest(kind="full_scan"))
    session.commit()
    n = worker_mod.process_pending_requests(session, None, today=date(2026, 6, 2),
                                            now=datetime(2026, 6, 2))
    assert n == 1
    req = session.query(models.ScanRequest).one()
    assert req.status == "done"
    assert req.result_summary["health"] == "degraded"
    assert req.result_summary["health_reasons"] == ["r1"]
```

- [ ] **Step 3: Run to verify both fail**

Run: `uv run pytest tests/skrendam/test_cli.py tests/skrendam/test_worker.py -vv`
Expected: FAIL (no exit code 2; `result_summary` lacks `health`)

- [ ] **Step 4: Update the CLI run-scan branch (cli.py:58-61)**

```python
    if args.cmd == "run-scan":
        s = run_scan_command(seed=args.seed)
        print(f"scan complete: {s.candidates_found} candidates, {s.matches_created} matches, "
              f"{s.errors} errors")
        if s.health is not None and s.health.degraded:
            print("WARNING: scan DEGRADED — results are not a trustworthy picture of the market:")
            for reason in s.health.reasons:
                print(f"  - {reason}")
            raise SystemExit(2)
```

- [ ] **Step 5: Update the worker full_scan branch (worker.py:56-62)**

```python
            elif req.kind == "full_scan":
                summary = run_scan(session, today=today, adapter=adapter, scanner_version=scanner_version)
                req.result_summary = {
                    "candidates_found": summary.candidates_found,
                    "matches_created": summary.matches_created,
                    "errors": summary.errors,
                    "health": summary.health.status if summary.health else "unknown",
                    "health_reasons": summary.health.reasons if summary.health else [],
                }
```

- [ ] **Step 6: Run the tests**

Run: `uv run pytest tests/skrendam/test_cli.py tests/skrendam/test_worker.py -vv`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add skrendam/cli.py skrendam/worker.py tests/skrendam/test_cli.py tests/skrendam/test_worker.py
git commit -m "feat(skrendam): degraded scans exit 2 from the CLI and surface in worker results"
```

---

## Stage 6 — Cadence + ops docs

### Task 7: daily-scan.sh + launchd template + install script + docs

**Files:**
- Create: `scripts/daily-scan.sh` (mode 755)
- Create: `scripts/launchd/com.skrendam.daily-scan.plist`
- Create: `scripts/install-daily-scan.sh` (mode 755)
- Create: `docs/ops/daily-scan.md`

- [ ] **Step 1: Write scripts/daily-scan.sh**

```bash
#!/usr/bin/env bash
# Daily Skrendam scan, designed to be launched by launchd (see install-daily-scan.sh).
# Logs to ~/Library/Logs/skrendam/daily-scan.log.
# Exit codes: 0 healthy, 2 degraded (propagated from `skrendam run-scan`), 1 setup failure.
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/skrendam"
LOG_FILE="$LOG_DIR/daily-scan.log"
mkdir -p "$LOG_DIR"

# The engine reads SKRENDAM_DATABASE_URL. If unset, reuse the Neon dev-branch URL
# the apps already use (web/.env.local, gitignored — the secret never enters the repo).
if [ -z "${SKRENDAM_DATABASE_URL:-}" ] && [ -f "$REPO_DIR/web/.env.local" ]; then
  url="$(grep -E '^DATABASE_URL=' "$REPO_DIR/web/.env.local" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$url" ] && export SKRENDAM_DATABASE_URL="$url"
fi
if [ -z "${SKRENDAM_DATABASE_URL:-}" ]; then
  echo "$(date -Iseconds) ERROR: no SKRENDAM_DATABASE_URL and no web/.env.local DATABASE_URL" >> "$LOG_FILE"
  exit 1
fi

{
  echo "===== $(date -Iseconds) daily scan starting (repo: $REPO_DIR) ====="
  cd "$REPO_DIR" && uv run skrendam run-scan
  code=$?
  echo "===== $(date -Iseconds) finished with exit $code ====="
  exit $code
} >> "$LOG_FILE" 2>&1
```

- [ ] **Step 2: Write scripts/launchd/com.skrendam.daily-scan.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.skrendam.daily-scan</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>__REPO_DIR__/scripts/daily-scan.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>__HOME__/Library/Logs/skrendam/launchd.out.log</string>
  <key>StandardErrorPath</key><string>__HOME__/Library/Logs/skrendam/launchd.err.log</string>
</dict>
</plist>
```

- [ ] **Step 3: Write scripts/install-daily-scan.sh**

```bash
#!/usr/bin/env bash
# Render the launchd template with absolute paths and load it for this user.
# Usage: scripts/install-daily-scan.sh [--uninstall]
# Run this from the PRIMARY checkout (not a worktree) — the plist hardcodes the repo path.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SRC="$REPO_DIR/scripts/launchd/com.skrendam.daily-scan.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.skrendam.daily-scan.plist"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "uninstalled com.skrendam.daily-scan"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/skrendam"
sed -e "s|__REPO_DIR__|$REPO_DIR|g" -e "s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"
launchctl bootout "gui/$(id -u)" "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
echo "installed: daily scan at 06:00 local time; logs in ~/Library/Logs/skrendam/"
echo "trigger a run now:  launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan"
```

- [ ] **Step 4: Write docs/ops/daily-scan.md**

```markdown
# Daily scan cadence (launchd, dev Mac)

The engine's designed heartbeat is one scan per day at 06:00 (Europe/Vilnius). Until there is a
hosted scheduler, it runs on the dev Mac via a launchd user agent.

## Install (from the PRIMARY checkout, after merge)

    scripts/install-daily-scan.sh

This renders `scripts/launchd/com.skrendam.daily-scan.plist` with absolute paths into
`~/Library/LaunchAgents/` and loads it. Uninstall with `--uninstall`.

## What it runs

`scripts/daily-scan.sh` → `uv run skrendam run-scan` against the Neon dev-branch DB.
The connection string is read from `SKRENDAM_DATABASE_URL`, falling back to `DATABASE_URL` in
`web/.env.local` (gitignored). The secret never enters the repo or the plist.

## Where to look

- Log: `~/Library/Logs/skrendam/daily-scan.log` — one block per run, ending in
  `finished with exit 0` (healthy) or `exit 2` (DEGRADED — reasons are printed above it).
- Deal Desk dashboard — shows a warning banner whenever the latest run is degraded/failed.

## Behavior notes

- **Mac asleep at 06:00:** launchd runs a missed `StartCalendarInterval` job once on next wake —
  late, never twice.
- **Degraded ≠ discarded:** a degraded run's data is committed; the status means "don't trust this
  as a picture of the market" (see `CONTEXT.md` → Scan health).
- The `skrendam worker` queue-poller (admin enqueue buttons) is NOT covered by this job — start it
  manually when needed: `uv run skrendam worker`.
```

- [ ] **Step 5: Make the scripts executable and smoke-test the failure path**

```bash
chmod +x scripts/daily-scan.sh scripts/install-daily-scan.sh
# Failure path: no env var and no web/.env.local in a temp HOME -> exit 1 with a logged error
env -i HOME=/tmp/skrendam-cadence-test PATH=/usr/bin:/bin bash -c '
  mkdir -p /tmp/skrendam-cadence-test && cd '"$PWD"' &&
  SKRENDAM_DATABASE_URL= bash scripts/daily-scan.sh; echo "exit=$?"'
cat /tmp/skrendam-cadence-test/Library/Logs/skrendam/daily-scan.log
rm -rf /tmp/skrendam-cadence-test
```
Expected: `exit=1` and an `ERROR: no SKRENDAM_DATABASE_URL...` log line. (NOTE: the script reads
`web/.env.local` from the repo — in the worktree that file does not exist, which is exactly the
failure path being tested. The success path runs a ~25-minute real scan and is exercised once in
Task 10.)

- [ ] **Step 6: Render-test the plist install (no bootstrap)**

```bash
sed -e "s|__REPO_DIR__|$PWD|g" -e "s|__HOME__|$HOME|g" \
  scripts/launchd/com.skrendam.daily-scan.plist | plutil -lint -
```
Expected: `-: OK`

- [ ] **Step 7: Commit**

```bash
git add scripts/daily-scan.sh scripts/launchd/com.skrendam.daily-scan.plist \
        scripts/install-daily-scan.sh docs/ops/daily-scan.md
git commit -m "feat(ops): daily-scan launchd cadence — script, plist template, installer, docs"
```

---

### Task 8: Upstream-watch doc

**Files:**
- Create: `docs/ops/upstream-watch.md`

- [ ] **Step 1: Write the doc**

```markdown
# Upstream fli watch (weekly scheduled agent)

`fli/` is a vendored fork of `punitarani/fli`. When Google changes their private API, the fix
usually lands upstream first. A weekly scheduled cloud agent keeps that visible without
unvendoring.

## The routine

Create with `/schedule` (cron: Mondays 09:00 Europe/Vilnius). Agent prompt:

> Check https://github.com/punitarani/fli for commits newer than the last report (use the repo's
> commit list; no clone needed). If there are new commits, summarize each one-line and flag any
> that touch `fli/search/` (especially `_wire.py`, `_decoders.py`, `_proto.py`, `client.py`,
> `dates.py`, `flights.py`) or `fli/models/` — those are the files that break when Google changes
> the API format. Compare against our vendored copy at Whirlywack/skrendam `fli/` only for flagged
> files, and end with a one-line verdict: NOTHING RELEVANT / WORTH REVIEWING (list files) /
> URGENT (decoder/format change). Keep the report under 30 lines.

## Why not unvendor

We keep the fork patchable (e.g. a future HTML fetch path needs `impersonate=` on GET, which
upstream's `client.get()` does not pass). The watch keeps the cost of vendoring — drift — visible.

## When the agent flags a decoder change

Cherry-pick upstream commits onto `fli/` in a feature branch, run `uv run pytest -q
--ignore=tests/search` plus one live probe, and ship through the normal PR gate.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ops/upstream-watch.md
git commit -m "docs(ops): weekly upstream-watch agent for the vendored fli fork"
```

---

## Stage 7 — Live DB + web surfacing

### Task 9: Apply migration 0007 to Neon dev + Drizzle re-pull

**Files:**
- No repo files; live-DB operation + `web/src/db/generated/*` refresh

- [ ] **Step 1: Confirm the engine suite is green first**

Run: `uv run pytest -q --ignore=tests/search`
Expected: all pass (this is the gate the spec requires before touching live data)

- [ ] **Step 2: Confirm the target DB, then upgrade**

The target is the **Neon dev branch** (`yip` project, branch `dev` — the DB web/site use, where
migration 0006 already lives). Read the URL from `web/.env.local` in the PRIMARY checkout without
printing the secret:

```bash
SKRENDAM_DATABASE_URL="$(grep -E '^DATABASE_URL=' /Users/superoptimised/Documents/Skrendam/web/.env.local | head -1 | cut -d= -f2- | tr -d '"')" \
  bash -c 'echo "host: $(echo "$SKRENDAM_DATABASE_URL" | sed -E "s|.*@([^/]+)/.*|\1|")" && uv run alembic upgrade head'
```
Expected: prints the Neon host (no credentials), then
`Running upgrade 0006_multi_strategy_scoring -> 0007_fli_resilience`.

- [ ] **Step 3: Re-pull the Drizzle schema and verify the columns arrived**

```bash
cd web && npm run db:pull && cd ..
git diff web/src/db/generated/ | grep -E "health|unverified"
```
Expected: the diff shows `health` added to `scanRuns` and `unverifiedSince` added to
`publishedDeals` in `web/src/db/generated/schema.ts`.

- [ ] **Step 4: Commit the regenerated schema**

```bash
git add web/src/db/generated
git commit -m "chore(web): db:pull — scan_runs.health + published_deals.unverified_since"
```

---

### Task 10: Web — banner, unverified chip, mapper + vitest

**Files:**
- Modify: `web/src/lib/types.ts:25` (ScanView)
- Modify: `web/src/lib/mappers.ts:68-83` (ScanRunish + toScanView)
- Create: `web/src/components/ScanHealthBanner.tsx`
- Modify: `web/src/app/(app)/page.tsx` (render the banner)
- Modify: `web/src/components/PublishedBoard.tsx` (unverified chip, next to the validUntil block at ~:83)
- Modify: `web/src/app/globals.css` (banner styles)
- Test: `web/src/lib/mappers.test.ts` (append)

- [ ] **Step 1: Append the failing vitest cases**

```ts
// append to web/src/lib/mappers.test.ts (toScanView is exported from './mappers';
// extend the existing import line if it isn't already imported)
describe('toScanView health', () => {
  it('exposes degraded status and reasons', () => {
    const v = toScanView({
      status: 'degraded',
      health: { reasons: ['6/6 calendar searches returned no data'] },
    });
    expect(v.status).toBe('degraded');
    expect(v.healthReasons).toEqual(['6/6 calendar searches returned no data']);
  });

  it('defaults healthReasons to empty', () => {
    expect(toScanView(null).healthReasons).toEqual([]);
    expect(toScanView({ status: 'completed' }).healthReasons).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (in `web/`): `npm test -- --run`
Expected: FAIL (`healthReasons` undefined)

- [ ] **Step 3: Extend ScanView (types.ts:25)**

```ts
export interface ScanView { fares: string; airports: number; ago: string; newToday: number; status: string; healthReasons: string[]; }
```

- [ ] **Step 4: Extend the mapper (mappers.ts)**

Replace the `ScanRunish` type and `toScanView`:

```ts
type ScanRunish = {
  apiCalls?: number | null;
  routesScanned?: number | null;
  startedAt?: string | Date | null;
  candidatesFound?: number | null;
  status?: string | null;
  health?: { reasons?: string[] } | null;
};

export function toScanView(run: ScanRunish | null): ScanView {
  if (!run) return { fares: '0', airports: 0, ago: '—', newToday: 0, status: 'never run', healthReasons: [] };
  return {
    fares: String(run.apiCalls ?? 0), airports: run.routesScanned ?? 0,
    ago: timeAgo(run.startedAt ? String(run.startedAt) : null),
    newToday: run.candidatesFound ?? 0, status: run.status ?? 'unknown',
    healthReasons: run.health?.reasons ?? [],
  };
}
```

(If `scanRuns.health` introspects as a permissive JSON type, cast at the call site in
`page.tsx` — `toScanView(run as Parameters<typeof toScanView>[0])` — rather than weakening the type.)

- [ ] **Step 5: Create the banner component**

```tsx
// web/src/components/ScanHealthBanner.tsx
export function ScanHealthBanner({ status, reasons }: { status: string; reasons: string[] }) {
  if (status !== 'degraded' && status !== 'failed') return null;
  return (
    <div className="scan-health-banner" role="alert">
      <strong>{status === 'failed' ? 'Last scan failed' : 'Last scan degraded'}</strong>
      <span> — its results are not a trustworthy picture of the market. Avoid bulk rechecks.</span>
      {reasons.length > 0 && (
        <ul>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Append to `web/src/app/globals.css` (coral tokens exist in `src/styles/colors_and_type.css`):

```css
.scan-health-banner {
  background: var(--coral-50);
  border: 1px solid var(--coral-200);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 14px;
}
.scan-health-banner ul { margin: 6px 0 0; padding-left: 18px; }
```

- [ ] **Step 6: Render it on the dashboard**

In `web/src/app/(app)/page.tsx`: import the component and render it directly above the existing
dashboard cards markup, fed from the mapped view:

```tsx
import { ScanHealthBanner } from '@/components/ScanHealthBanner';
// ... inside the component, scan = toScanView(run) already exists:
<ScanHealthBanner status={scan.status} reasons={scan.healthReasons} />
```

- [ ] **Step 7: Add the unverified chip to PublishedBoard.tsx**

Next to the existing `deal.validUntil` block (~line 83), following its exact pattern:

```tsx
{deal.unverifiedSince && (
  <span className="stat rejected">
    unverified since {String(deal.unverifiedSince).slice(0, 10)}
  </span>
)}
```

(`.stat rejected` is the established warning-pill style — see `StatusPill.tsx`.)

- [ ] **Step 8: Run vitest + typecheck + build**

Run (in `web/`): `npm test -- --run && npm run build`
Expected: tests PASS, build succeeds (the generated schema from Task 9 provides
`health`/`unverifiedSince` types)

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/mappers.ts web/src/components/ScanHealthBanner.tsx \
        web/src/app/\(app\)/page.tsx web/src/components/PublishedBoard.tsx \
        web/src/app/globals.css web/src/lib/mappers.test.ts
git commit -m "feat(web): degraded-scan banner + unverified-since chip on the deal desk"
```

---

## Stage 8 — Verification & ship

### Task 11: Full verification + first real heartbeat + PR gate

- [ ] **Step 1: Full offline suite + lint on changed files**

```bash
uv run pytest -q --ignore=tests/search
uv run ruff check skrendam tests/skrendam scripts alembic/versions/0007_fli_resilience.py
uv run ruff format --check skrendam/fli_adapter/health.py skrendam/fli_adapter/adapter.py \
  skrendam/scanning/orchestrator.py skrendam/verification.py skrendam/cli.py skrendam/worker.py
```
Expected: suite passes; no NEW ruff findings in the files this branch touched (pre-existing
`ruff format` debt in `tests/skrendam/` is a known, out-of-scope CI red — do not reformat
unrelated files).

- [ ] **Step 2: First real heartbeat — run daily-scan.sh against Neon dev (background, ~25 min)**

```bash
SKRENDAM_DATABASE_URL="$(grep -E '^DATABASE_URL=' /Users/superoptimised/Documents/Skrendam/web/.env.local | head -1 | cut -d= -f2- | tr -d '"')" \
  bash scripts/daily-scan.sh; echo "exit=$?"
tail -3 ~/Library/Logs/skrendam/daily-scan.log
```
Expected: `exit=0` (or `2` with printed reasons if Google is gating right now — either way the
mechanism is demonstrated). This is also the dev DB's **second-ever scan**: from now on the
`drop` detector has a previous price to compare against, and the cliff signal has a "yesterday."
Then verify in the DB that the new run row carries `health` JSON and a sensible status.

- [ ] **Step 3: PR gate (mandatory, see docs/PR-GATE.md)**

```bash
scripts/pr-gate.sh
```
Then complete the gate's **two mandatory code-review passes** (`superpowers:requesting-code-review`
/ `/code-review`) before opening the PR.

- [ ] **Step 4: Open the PR**

PR title: `feat(skrendam): fli resilience — silent-empty detection, recheck fail-safe, expiry sweep, daily cadence`
Body: link the spec (`docs/superpowers/specs/2026-06-11-fli-resilience-design.md`), summarize the
four product changes (degraded verdicts, never-expire-on-empty, date sweep, cadence), note the
additive 0007 migration is already applied to Neon dev, and that
`scripts/install-daily-scan.sh` should be run from the primary checkout after merge.

- [ ] **Step 5: Post-merge ops (manual, documented)**

- Run `scripts/install-daily-scan.sh` from `/Users/superoptimised/Documents/Skrendam`.
- Create the weekly upstream-watch routine via `/schedule` using the prompt in
  `docs/ops/upstream-watch.md`.
