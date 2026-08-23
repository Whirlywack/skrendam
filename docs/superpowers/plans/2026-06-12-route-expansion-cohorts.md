# Route Expansion + Scan Cohorts Implementation Plan (Pilot Workstream A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan ~120–150 VNO/KUN/RIX routes inside the Google-gating budget via tiered cohorts (daily core + tunable tail rotation), with a flights cache, drop-staleness labeling, a marketability gate, bulk route add in the admin, and a founder-reviewable seed list.

**Architecture:** A `routes.core` flag (migration 0008) plus a *computed* tail slice (`route.id % rotation_days == today.toordinal() % rotation_days`) selects "due today" routes in the orchestrator before resolution; `--all-routes` is the explicit full-network path. Tier-2 fetches get an in-process cache; `drop` reasons carry comparison age; template matching gains a `min_departure_dates` gate fed by a per-candidate near-price date count.

**Tech Stack:** Python 3.13 / SQLAlchemy / Alembic / pytest (in-memory SQLite + fake backends); Next.js admin (`web/`) with Drizzle (introspected — never hand-edit), vitest; Neon Postgres.

**Spec:** `docs/superpowers/specs/2026-06-12-route-expansion-cohorts-design.md` — read it first; its decision table is binding.

**House rules that bind every task:**
- Worktree: all work in `.claude/worktrees/feat+route-expansion`, branch `feat/route-expansion`.
- Engine tests: `uv run pytest -q --ignore=tests/search`. Web tests: `cd web && npm test`.
- Ruff: `make lint` / `make format` before each commit (100-char lines, Google docstrings).
- Migrations additive-only; `tests/skrendam/test_migration.py` (alembic upgrade + `alembic check`) must stay green.
- Never edit Drizzle-generated files by hand; re-pull after the migration in **both** `web/` and `site/`.
- Commit messages: conventional commits, with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.

---

### Task 1: Migration 0008 + model columns

**Files:**
- Modify: `skrendam/db/models.py` (Route ~L37, DealTemplate ~L72, Candidate)
- Create: `alembic/versions/0008_route_expansion.py`
- Test: `tests/skrendam/test_models.py` (append), existing `tests/skrendam/test_migration.py` must stay green

- [ ] **Step 1: Write the failing test** — append to `tests/skrendam/test_models.py`:

```python
def test_0008_columns_exist(session):
    from skrendam.db import models

    r = models.Route(origin="VNO", destination="BCN", zone="MED")
    session.add(models.Zone(zone="MED", haul_type="short"))
    session.add(r)
    session.flush()
    assert r.core is False  # default

    t_cols = models.DealTemplate.__table__.columns
    assert "min_departure_dates" in t_cols
    c_cols = models.Candidate.__table__.columns
    assert "departure_date_count" in c_cols
```

- [ ] **Step 2: Run it to verify it fails**

Run: `uv run pytest tests/skrendam/test_models.py::test_0008_columns_exist -q`
Expected: FAIL (`AttributeError: core` or KeyError on column).

- [ ] **Step 3: Add the model columns**

In `skrendam/db/models.py` — `Route`, after `enabled`:

```python
    # Core routes scan every day; non-core rotate (orchestrator due_routes()).
    core: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
```

`DealTemplate`, after `min_abs_savings_eur`:

```python
    # Marketability gate: minimum near-price departure dates for a match (NULL = exempt).
    min_departure_dates: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

`Candidate` — next to `discount_pct` (find `class Candidate` in the same file):

```python
    # Calendar dates priced <=110% of this fare, counted in the DISCOVERING spec's
    # window. Two templates with different windows can match one candidate; the
    # stored count came from whichever spec found it first. Accepted v1 imprecision.
    departure_date_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

- [ ] **Step 4: Create `alembic/versions/0008_route_expansion.py`** (mirror 0007's format):

```python
"""Route expansion: routes.core, deal_templates.min_departure_dates,
candidates.departure_date_count.

Revision ID: 0008_route_expansion
Revises: 0007_fli_resilience
Create Date: 2026-06-12
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_route_expansion"
down_revision = "0007_fli_resilience"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add cohort, marketability-gate, and departure-date-count columns."""
    op.add_column(
        "routes",
        sa.Column("core", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "deal_templates",
        sa.Column("min_departure_dates", sa.Integer(), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column(
            "departure_date_count",
            sa.Integer(),
            nullable=True,
            comment=(
                "Calendar dates priced <=110% of the fare, window-relative to the "
                "DISCOVERING spec - may differ from another matching template's window."
            ),
        ),
    )


def downgrade() -> None:
    """Remove the three 0008 columns."""
    op.drop_column("candidates", "departure_date_count")
    op.drop_column("deal_templates", "min_departure_dates")
    op.drop_column("routes", "core")
```

- [ ] **Step 5: Run model + migration tests**

Run: `uv run pytest tests/skrendam/test_models.py tests/skrendam/test_migration.py -q`
Expected: PASS (alembic check sees no drift). If `alembic check` flags a server_default
mismatch on `routes.core`, the model column is missing `server_default=text("false")` —
both sides must declare it.

- [ ] **Step 6: Lint + commit**

```bash
make lint && git add skrendam/db/models.py alembic/versions/0008_route_expansion.py tests/skrendam/test_models.py
git commit -m "feat(db): migration 0008 - routes.core, min_departure_dates, departure_date_count"
```

---

### Task 2: Cohort selection — settings, due_routes(), orchestrator wiring, CLI, plan block

**Files:**
- Modify: `skrendam/config.py`, `skrendam/scanning/orchestrator.py`, `skrendam/fli_adapter/health.py:184` (`health_json`), `skrendam/cli.py`
- Test: `tests/skrendam/test_orchestrator.py` (append), `tests/skrendam/test_config.py` (append), `tests/skrendam/test_cli.py` (append)

- [ ] **Step 1: Write failing tests** — append to `tests/skrendam/test_orchestrator.py`:

```python
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
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, tail_rotation_days=10)
    run = session.query(models.ScanRun).one()
    assert run.health["plan"] == {"core": 1, "tail": 0, "specs_planned": 1}
```

Append to `tests/skrendam/test_config.py`:

```python
def test_tail_rotation_days_default_and_env(monkeypatch):
    from skrendam.config import Settings

    assert Settings().tail_rotation_days == 10
    monkeypatch.setenv("SKRENDAM_TAIL_ROTATION_DAYS", "3")
    assert Settings().tail_rotation_days == 3
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_orchestrator.py tests/skrendam/test_config.py -q`
Expected: FAIL — `run_scan() got an unexpected keyword argument 'tail_rotation_days'`, Settings attr missing.

- [ ] **Step 3: Implement**

`skrendam/config.py` — after `circuit_breaker_threshold`:

```python
    # Tail-cohort rotation width in days: core routes scan daily, every other enabled
    # route scans when route.id % N == today.toordinal() % N. Start 10 (inside the
    # observed ~40-60 specs/run gating budget); tighten toward 3 as health data allows.
    tail_rotation_days: int = 10
```

`skrendam/scanning/orchestrator.py` — add a pure selector above `run_scan`:

```python
def due_routes(routes, today: date, rotation_days: int, all_routes: bool = False) -> list:
    """Routes to scan today: enabled AND (core OR today's rotation slot).

    The tail slice is computed, not stored - retuning rotation_days never
    rewrites route rows. A width retune can leave a route unscanned for up to
    old-N days before its new slot comes up: harmless, self-healing, by design.
    """
    enabled = [r for r in routes if r.enabled]
    if all_routes:
        return enabled
    slot = today.toordinal() % rotation_days
    return [r for r in enabled if r.core or r.id % rotation_days == slot]
```

In `run_scan`, change the signature and the route loading (currently L46–66):

```python
def run_scan(
    session: Session,
    today: date,
    adapter: FliAdapter,
    scanner_version: str = "0.1.0",
    circuit_breaker_threshold: int = 5,
    tail_rotation_days: int = 10,
    all_routes: bool = False,
) -> ScanSummary:
```

and replace `routes = list(session.scalars(select(models.Route)))` with:

```python
    routes = due_routes(
        list(session.scalars(select(models.Route))), today, tail_rotation_days, all_routes
    )
```

(`route_by_pair` and `resolve()` keep working unchanged — they receive the filtered list.)
After `routes`/`templates` are loaded, compute the plan block:

```python
    core_n = sum(1 for r in routes if r.core)
    plan = {
        "core": core_n,
        "tail": len(routes) - core_n,
        "specs_planned": sum(len(resolve(tpl, routes, today)) for tpl in templates),
    }
```

and change the health stamp near the end (currently `run.health = health_json(...)`):

```python
    run.health = health_json(verdict, adapter.call_log, plan=plan)
```

`skrendam/fli_adapter/health.py` — extend `health_json`:

```python
def health_json(verdict: HealthVerdict, log: CallLog, plan: dict | None = None) -> dict:
```

and in its return dict add `"plan": plan or {},` as the first key (update the docstring's
key list accordingly).

`skrendam/cli.py` — in `main()` add to the `run-scan` subparser:

```python
    rs.add_argument("--all-routes", action="store_true",
                    help="scan the full network, ignoring cohort rotation")
```

thread it through (`run_scan_command(seed=args.seed, all_routes=args.all_routes)`) and:

```python
def run_scan_command(session_factory=None, backend=None, today=None, seed=False,
                     all_routes=False) -> ScanSummary:
    ...
    return run_scan(session, today=today, adapter=adapter,
                    scanner_version=settings.scanner_version,
                    tail_rotation_days=settings.tail_rotation_days,
                    all_routes=all_routes)
```

**Worker threading (same step):** `skrendam/worker.py`'s `full_scan` branch (~L77) calls
`run_scan(session, today=today, adapter=adapter, scanner_version=scanner_version)` —
without threading it would silently use the default 10 instead of Settings. Add a
`tail_rotation_days: int = 10` parameter to `poll_loop(...)`, pass it into that
`run_scan` call, and in `cli.py worker_command()` pass
`tail_rotation_days=settings.tail_rotation_days` to `poll_loop`. (Worker `full_scan`
deliberately inherits the due-today default — spec decision; no `all_routes` plumbing.)

- [ ] **Step 4: Run the tests**

Run: `uv run pytest tests/skrendam/test_orchestrator.py tests/skrendam/test_config.py tests/skrendam/test_cli.py tests/skrendam/test_health.py -q`
Expected: PASS (existing health tests still green — `plan` param is optional).

- [ ] **Step 5: Full engine suite, lint, commit**

```bash
uv run pytest -q --ignore=tests/search && make lint
git add -A && git commit -m "feat(engine): tiered scan cohorts - core daily + computed tail rotation, --all-routes, plan block"
```

---

### Task 3: Flights cache in the adapter

**Files:**
- Modify: `skrendam/fli_adapter/adapter.py`
- Test: `tests/skrendam/test_adapter.py` (append)

- [ ] **Step 1: Write the failing test** — append to `tests/skrendam/test_adapter.py` (match the file's existing fake-backend style):

```python
def test_search_flights_cached_per_itinerary_key():
    calls = []

    class CountingBackend:
        def search_flights(self, origin, destination, travel_date, return_date, cabin):
            calls.append((origin, destination, travel_date, return_date, cabin))
            return [{"price": 100.0, "currency": "EUR", "stops": 0, "duration": 100,
                     "legs": [], "self_transfer": False, "mixed_cabin": False,
                     "booking_url": None}]

    from datetime import date
    from skrendam.fli_adapter.adapter import FliAdapter

    a = FliAdapter(CountingBackend(), pace=lambda: None)
    d = date(2026, 9, 1)
    first = a.search_flights("VNO", "BCN", d, None, "ECONOMY")
    second = a.search_flights("VNO", "BCN", d, None, "ECONOMY")  # cache hit
    a.search_flights("VNO", "BCN", d, date(2026, 9, 8), "ECONOMY")  # different key

    assert len(calls) == 2          # second identical call never hit the network
    assert a.api_calls == 2         # cache hits don't count as api calls
    assert a.call_log.count("flights") == 2  # ...nor as call-log records
    assert first == second
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_adapter.py::test_search_flights_cached_per_itinerary_key -q`
Expected: FAIL — `len(calls) == 3`.

- [ ] **Step 3: Implement** — in `FliAdapter.__init__` add:

```python
        self._flights_cache: dict[tuple, list[FareItinerary]] = {}
```

At the top of `search_flights` (before `self._pace()`), add:

```python
        key = (origin, destination, travel_date, return_date, cabin)
        if key in self._flights_cache:
            return self._flights_cache[key]
```

and after the successful `call_log.record(...)` at the end:

```python
        self._flights_cache[key] = fares
        return fares
```

(replacing the bare `return fares`). Update the class docstring's "Handles caching" note
to mention both caches. Errors are NOT cached — a retry on the next template is wanted.

- [ ] **Step 4: Run adapter + orchestrator tests**

Run: `uv run pytest tests/skrendam/test_adapter.py tests/skrendam/test_orchestrator.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
make lint && git add -A && git commit -m "feat(adapter): in-process tier-2 flights cache keyed (route, dates, cabin)"
```

---

### Task 4: Drop staleness — previous_point(), ScoringContext age, aged reason_text

**Files:**
- Modify: `skrendam/scanning/history.py:39`, `skrendam/scanning/scoring/base.py:34`, `skrendam/scanning/scoring/drop.py`, `skrendam/scanning/orchestrator.py` (`_persist_fare`, currently ~L210)
- Test: `tests/skrendam/test_price_history.py`, `tests/skrendam/test_scoring_drop.py` (append to both)

- [ ] **Step 1: Write failing tests** — append to `tests/skrendam/test_price_history.py`:

```python
def test_previous_point_returns_most_recent_with_age_material():
    from datetime import date, datetime
    from skrendam.scanning.history import HistoryPoint, PriceHistorySeries

    pts = (
        HistoryPoint(scanned_at=datetime(2026, 6, 1), travel_date=date(2026, 9, 1), price=200.0),
        HistoryPoint(scanned_at=datetime(2026, 6, 3), travel_date=date(2026, 9, 1), price=180.0),
    )
    s = PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)
    pt = s.previous_point(date(2026, 9, 1), datetime(2026, 6, 15))
    assert pt is not None and pt.price == 180.0 and pt.scanned_at == datetime(2026, 6, 3)
    assert s.previous_point(date(2026, 9, 2), datetime(2026, 6, 15)) is None
    # previous_price stays consistent with previous_point
    assert s.previous_price(date(2026, 9, 1), datetime(2026, 6, 15)) == 180.0
```

Append to `tests/skrendam/test_scoring_drop.py` (reuse the file's existing context-builder
helper; the snippets below show intent — adapt the constructor call to the helper):

```python
def test_drop_reason_states_age_when_stale(drop_ctx_factory=None):
    from skrendam.scanning.scoring.drop import PriceDropScorer

    ctx = _ctx(price=100.0, previous_price=200.0, previous_price_age_days=12)
    score = PriceDropScorer().score(ctx)
    assert score is not None
    assert "12 days ago" in score.reason_text
    assert score.signals["previous_price_age_days"] == 12


def test_drop_reason_fresh_comparison_keeps_last_scan_copy():
    from skrendam.scanning.scoring.drop import PriceDropScorer

    ctx = _ctx(price=100.0, previous_price=200.0, previous_price_age_days=1)
    score = PriceDropScorer().score(ctx)
    assert score is not None
    assert "since the last scan" in score.reason_text
```

(`_ctx` = the existing local helper that builds a `ScoringContext` with an
itinerary-OK fare and template; extend it to accept `previous_price_age_days`.)

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_price_history.py tests/skrendam/test_scoring_drop.py -q`
Expected: FAIL — `previous_point` missing, `previous_price_age_days` unexpected.

- [ ] **Step 3: Implement**

`skrendam/scanning/history.py` — in `PriceHistorySeries`, refactor:

```python
    def previous_point(self, travel_date: date, before: datetime) -> HistoryPoint | None:
        """Most recent recorded point for this travel_date strictly before `before`."""
        cands = [p for p in self.points if p.travel_date == travel_date and p.scanned_at < before]
        if not cands:
            return None
        return max(cands, key=lambda p: p.scanned_at)

    def previous_price(self, travel_date: date, before: datetime) -> float | None:
        """Most recent recorded price for this travel_date strictly before `before`."""
        pt = self.previous_point(travel_date, before)
        return pt.price if pt else None
```

`skrendam/scanning/scoring/base.py` — `ScoringContext` gains:

```python
    previous_price_age_days: int | None = None
```

`skrendam/scanning/orchestrator.py` `_persist_fare` — replace
`prev = hist_series.previous_price(point.travel_date, now)` with:

```python
    prev_pt = hist_series.previous_point(point.travel_date, now)
    prev = prev_pt.price if prev_pt else None
    prev_age = (now - prev_pt.scanned_at).days if prev_pt else None
```

and pass `previous_price=prev, previous_price_age_days=prev_age` into `ScoringContext`.

`skrendam/scanning/scoring/drop.py` — replace the reason construction:

```python
        age = ctx.previous_price_age_days
        if age is not None and age > 1:
            tail = f"seen {age} days ago"
        else:
            tail = "since the last scan"
        reason = (f"EUR{ctx.fare.price:.0f} - down {round(drop * 100)}% from "
                  f"EUR{prev:.0f} {tail}.")
        return Score.from_value("drop", value, reason,
                                {"previous_price": prev, "drop_frac": round(drop, 3),
                                 "previous_price_age_days": age})
```

(Cohorts make week-old comparisons routine on tail routes; honest labeling instead of
an age cutoff — a cutoff would blind `drop` on the whole tail tier. No decay math.)

- [ ] **Step 4: Run scoring + history + orchestrator suites**

Run: `uv run pytest tests/skrendam/test_price_history.py tests/skrendam/test_scoring_drop.py tests/skrendam/test_orchestrator.py tests/skrendam/test_candidate_scores.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
make lint && git add -A && git commit -m "feat(scoring): drop reason states comparison age - cohort rotation makes stale previous_price routine"
```

---

### Task 5: Marketability gate — departure_date_count + min_departure_dates enforcement

**Files:**
- Modify: `skrendam/scanning/orchestrator.py` (flagged loop ~L106 and `_persist_fare`)
- Test: `tests/skrendam/test_orchestrator.py` (append)

- [ ] **Step 1: Write failing tests** — append to `tests/skrendam/test_orchestrator.py`:

```python
class SpreadBackend:
    """5 near-priced cheap dates (<=110% of the 30.0 fare) + 2 expensive ones."""

    def search_calendar(self, spec):
        d = date(2026, 7, 20)
        cheap = [(d.fromordinal(d.toordinal() + i), None, 30.0 + i * 0.5) for i in range(5)]
        dear = [(date(2026, 7, 28), None, 90.0), (date(2026, 7, 29), None, 95.0)]
        return cheap + dear

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return [{"price": 30.0, "currency": "EUR", "stops": 0, "duration": 215,
                 "legs": [{"airline": {"code": "W6"}}], "self_transfer": False,
                 "mixed_cabin": False, "booking_url": "https://x"}]


def test_gate_passes_when_enough_near_price_dates(session):
    _seed(session)  # template has min_departure_dates NULL by default here
    session.query(models.DealTemplate).update({"min_departure_dates": 5})
    session.commit()
    adapter = FliAdapter(SpreadBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter)
    assert summary.matches_created >= 1
    cand = session.query(models.Candidate).first()
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
    assert summary.matches_created >= 1
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -q -k gate`
Expected: FAIL — `departure_date_count` is None / gate not enforced.

- [ ] **Step 3: Implement** — in `skrendam/scanning/orchestrator.py`.

Module constant next to `CANDIDATE_TTL_DAYS`:

```python
NEAR_PRICE_FRAC = 1.10  # a date "supports" a fare if its calendar price is within +10%
```

In `run_scan`'s flagged loop, before calling `_persist_fare`, compute and pass the count:

```python
            for p in _flagged(points, base, zone):
                near_dates = sum(1 for q in points if q.price <= p.price * NEAR_PRICE_FRAC)
                ...
                _persist_fare(
                    session, run, route, zone, spec, p, fare, base, templates, now,
                    scanner_version, summary, history, near_dates,
                )
```

`_persist_fare` — add the parameter and use it twice:

```python
def _persist_fare(
    session, run, route, zone, spec, point, fare, base, templates, now,
    scanner_version, summary, history, departure_date_count,
):
```

In the template loop, after the `in_template_scope` check:

```python
        if (tpl.min_departure_dates is not None
                and departure_date_count < tpl.min_departure_dates):
            continue  # marketability gate: not enough near-price dates to plan around
```

In the `fields = dict(...)`, add:

```python
        departure_date_count=departure_date_count,
```

- [ ] **Step 4: Run the suite**

Run: `uv run pytest tests/skrendam/test_orchestrator.py tests/skrendam/test_repositories.py -q`
Expected: PASS (upsert_candidate passes the new field through `fields` untouched).

- [ ] **Step 5: Commit**

```bash
make lint && git add -A && git commit -m "feat(engine): marketability gate - near-price departure-date count + min_departure_dates"
```

---

### Task 6: Seed data — zones, vfr audience, two new templates, gate values

**Files:**
- Modify: `skrendam/seeds.py`
- Test: `tests/skrendam/test_seeds.py` (append)

- [ ] **Step 1: Write failing tests** — append to `tests/skrendam/test_seeds.py`:

```python
def test_every_roundtrip_template_sets_trip_len_min_days(session):
    from skrendam.seeds import seed_all

    seed_all(session)
    rts = session.query(models.DealTemplate).filter_by(trip_type="roundtrip").all()
    assert rts, "seed should contain roundtrip templates"
    missing = [t.slug for t in rts if t.trip_len_min_days is None]
    # resolver derives the RT calendar duration from trip_len_min_days alone;
    # NULL would flow duration=None into a roundtrip date search.
    assert missing == []


def test_new_templates_and_gate_values(session):
    from skrendam.seeds import seed_all

    seed_all(session)
    by_slug = {t.slug: t for t in session.query(models.DealTemplate).all()}

    vfr = by_slug["vfr-watch"]
    assert vfr.trip_type == "roundtrip" and vfr.trip_len_min_days == 3
    assert vfr.min_departure_dates == 5
    assert "LON" not in (vfr.included_destinations or [])  # real IATA codes only

    lh = by_slug["long-haul-opportunist"]
    assert lh.min_departure_dates is None and lh.trip_len_min_days == 7

    planable = ["family-school-holiday-sun", "september-sun", "christmas-markets",
                "plan-ahead-summer", "vfr-watch"]
    exempt = ["last-minute-weekends", "last-warm-days", "long-haul-opportunist"]
    assert all(by_slug[s].min_departure_dates == 5 for s in planable)
    assert all(by_slug[s].min_departure_dates is None for s in exempt)
    assert by_slug["christmas-markets"].min_discount_pct == 25  # 06-03 flood watch-item
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_seeds.py -q`
Expected: FAIL — `vfr-watch` missing.

- [ ] **Step 3: Implement in `skrendam/seeds.py`**

`AUDIENCES` gains:

```python
    ("vfr", "Visiting friends & family", "relaxed"),
```

`MOMENTS` gains:

```python
    ("vfr_visit", "VFR visit", "relative", "Cheap weekend to visit family abroad"),
    ("long_haul_chance", "Long-haul chance", "relative", "A long-haul fare worth planning around"),
```

`templates` list gains two entries (existing-entry style):

```python
        dict(slug="vfr-watch", name="VFR corridor watch",
             audience="vfr", moment="vfr_visit", trip_type="roundtrip",
             date_window_type="relative", rel_offset_start_days=7, rel_offset_end_days=90,
             included_destinations=["STN", "LTN", "LGW", "DUB", "OSL"],
             trip_len_min_days=3, trip_len_max_days=14, max_stops=1,
             psychological_price_threshold_eur=80, allow_smaller_discount_if_under_price=True,
             min_departure_dates=5, public_label="Visit-home fares", newsletter_tag="vfr",
             suggested_headline_template="{origin}->{destination} EUR{price} return",
             content_angle="Cheap weekend to visit family abroad"),
        dict(slug="long-haul-opportunist", name="Long-haul opportunist",
             audience="flexible_adults", moment="long_haul_chance", trip_type="roundtrip",
             date_window_type="relative", rel_offset_start_days=30, rel_offset_end_days=300,
             included_zones=["LONG_HAUL"], trip_len_min_days=7, trip_len_max_days=21,
             max_stops=2, min_discount_pct=30, public_label="Long-haul steal",
             newsletter_tag="long_haul", content_angle="A long-haul fare worth planning around"),
```

> `vfr-watch.included_destinations` MUST stay in sync with the Task 7 route list —
> Task 7's coverage test enforces it. If Task 7 adds e.g. `BGO`/`TRF`, extend it there.

Existing-template gate values — add to the existing dicts:
`family-school-holiday-sun`, `september-sun`, `christmas-markets`, `plan-ahead-summer`:
`min_departure_dates=5`; `christmas-markets` additionally `min_discount_pct=25`.
(`last-minute-weekends`, `last-warm-days` stay untouched: opportunistic, gate-exempt.)

**Note:** `_get_or_create` never updates, so existing dev/prod template rows won't pick
up the new gate values from seeds — the live-DB values are set in Task 10 (one-off SQL,
listed in the PR body). Fresh DBs get them from seeds; the tests run on fresh DBs.

- [ ] **Step 4: Run the suite**

Run: `uv run pytest tests/skrendam/test_seeds.py tests/skrendam/test_resolver.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
make lint && git add -A && git commit -m "feat(seeds): vfr-watch + long-haul-opportunist templates, marketability gate values"
```

---

### Task 7: Route seed list (~120–150) + new zone(s) + core picks + validation tests

This is the founder-judgment data task. The PROCEDURE is fixed; the data is research
output checked by tests and reviewed by the founder in the PR.

**Files:**
- Modify: `skrendam/seeds.py` (`ZONES`, `ROUTES`, `seed_all`)
- Create: `scripts/backfill_core_routes.py`
- Test: `tests/skrendam/test_seeds.py` (append)

- [ ] **Step 1: Research the network.** Use web search for the **current** (2026) route
  maps of VNO, KUN, RIX (operator networks: Ryanair, Wizz Air, airBaltic, LOT, Norwegian,
  Turkish, Lufthansa group, flydubai/El Al class). Produce `(origin, destination, zone, core)`
  tuples, target 120–150 total. Zone-assignment rules (record them in the PR body):
  MEDITERRANEAN = Med-coast leisure; CANARIES = Canary islands; SCANDINAVIA = Nordics;
  CITY_BREAKS = central/western Europe city pairs; WESTERN_EUROPE = UK/IE/FR/BE/NL/DE
  non-city-break leisure; LONG_HAUL = beyond-Europe far-haul. Destinations outside all
  six (TLV, DXB, AMM class) go to a NEW zone — do not force into LONG_HAUL.

- [ ] **Step 2: Write the validation tests first** — append to `tests/skrendam/test_seeds.py`:

```python
def test_route_list_size_and_validity():
    from fli.models import Airport

    from skrendam.seeds import ROUTES, ZONES, seed_all

    assert 120 <= len(ROUTES) <= 150
    zone_names = {z[0] for z in ZONES}
    assert len(ROUTES) == len({(o, d) for o, d, *_ in ROUTES})  # no dupes
    for o, d, z, *rest in ROUTES:
        assert o in {"VNO", "KUN", "RIX"}, f"{o}-{d}: pilot scope is VNO/KUN/RIX only"
        assert o in Airport.__members__, f"unknown origin {o}"
        assert d in Airport.__members__, f"unknown destination {d} ({o}-{d})"
        assert z in zone_names, f"{o}-{d}: zone {z} not seeded"


def test_core_composition_feeds_every_enabled_template(session):
    from skrendam.scanning.resolver import resolve
    from skrendam.seeds import seed_all

    seed_all(session)
    routes = session.query(models.Route).filter_by(enabled=True).all()
    core = [r for r in routes if r.core]
    assert 8 <= len(core) <= 12
    today = date(2026, 6, 15)
    for tpl in session.query(models.DealTemplate).filter_by(enabled=True).all():
        specs = resolve(tpl, core, today)
        assert specs, f"template {tpl.slug} has no core route feeding it"


def test_seed_never_reenables_disabled_route(session):
    from skrendam.seeds import seed_all

    seed_all(session)
    r = session.query(models.Route).first()
    r.enabled = False
    session.commit()
    seed_all(session)  # idempotent re-run
    session.refresh(r)
    assert r.enabled is False
```

Note: `test_core_composition_feeds_every_enabled_template` uses `resolve()` — it proves
zone/destination scoping actually matches, not just "a core route exists". The seasonal
templates resolve year-round (the window rolls forward), so `today` can be any date.

- [ ] **Step 3: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_seeds.py -q`
Expected: FAIL — ROUTES has 14 entries, no core flags.

- [ ] **Step 4: Implement.** `ROUTES` becomes 4-tuples `(origin, destination, zone, core)`
  — convert the existing 14 and add the researched list, grouped by origin with one
  comment line per origin block. Update `seed_all`:

```python
    for o, d, z, core in ROUTES:
        _get_or_create(session, models.Route, dict(zone=z, enabled=True, core=core),
                       origin=o, destination=d)
```

`ZONES` gains the new zone(s) with deliberately conservative thresholds, e.g.:

```python
    ("MIDDLE_EAST", "medium", 150, 60, 30),
```

(exact set follows Step 1's research; conservative = thresholds at or below the
comparable haul-type zone, so a new zone can only under-flag until calibrated).
Core picks (founder criteria, asserted by the composition test): 3–4 VFR corridor
routes, 3–4 proven leisure, 1–2 city-break staples, **plus 1 long-haul route** —
`long-haul-opportunist` scopes to the LONG_HAUL zone (which currently has zero routes),
and the composition test demands every enabled template be fed; without a long-haul
core pick it fails by design. Total stays within the 8–12 band.

- [ ] **Step 5: Create `scripts/backfill_core_routes.py`** — seeds never update existing
  rows, so pre-existing dev/prod routes can't receive their core flag from `seed_all`.
  One-off, idempotent, sets `core` ONLY (never `enabled`/`zone`):

```python
"""One-off: set routes.core=True for the workstream-A core picks on a live DB.

Seeds are insert-only by design (founder edits are never clobbered), so existing
rows need this explicit, reviewable backfill. Idempotent; only ever sets `core`.
Run once after migration 0008:  uv run python scripts/backfill_core_routes.py
"""

from sqlalchemy import select

from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.db import models
from skrendam.seeds import ROUTES

CORE_PAIRS = sorted({(o, d) for o, d, _z, core in ROUTES if core})


def main() -> None:
    session = make_sessionmaker(Settings())()
    changed = 0
    for origin, destination in CORE_PAIRS:
        route = session.scalar(
            select(models.Route).filter_by(origin=origin, destination=destination))
        if route is not None and not route.core:
            route.core = True
            changed += 1
    session.commit()
    print(f"core backfill: {changed} routes updated, {len(CORE_PAIRS)} core pairs total")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the full engine suite**

Run: `uv run pytest -q --ignore=tests/search`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
make lint && git add -A && git commit -m "feat(seeds): full VNO/KUN/RIX network (~1XX routes), core picks, new zone(s), core backfill script"
```

(replace 1XX with the real count). **PR body must list:** the zone-assignment rules, the
core picks with one-line rationale each, any excluded destinations, new-zone thresholds
+ "run `skrendam calibrate` after a week of history" note, and the backfill-script
run-once instruction.

---

### Task 8: Apply 0008 to Neon dev + Drizzle re-pull (both apps)

**Files:**
- Generated (commit, never hand-edit): `web/src/db/schema.ts` + relations (per `web/drizzle.config.ts` output paths), `site/` equivalents

- [ ] **Step 1: Apply the migration to live Neon dev**

```bash
url="$(grep -E '^DATABASE_URL=' /Users/superoptimised/Documents/Skrendam/web/.env.local | head -1 | cut -d= -f2- | tr -d '"')"
SKRENDAM_DATABASE_URL="$url" uv run alembic upgrade head
SKRENDAM_DATABASE_URL="$url" uv run alembic current   # expect: 0008_route_expansion (head)
```

- [ ] **Step 2: Re-pull Drizzle schemas in BOTH apps** (each worktree app dir needs its
  own `npm install` first if not done, and the env: copy `web/.env.local` from the
  primary checkout into the worktree's `web/` and `site/` — gitignored, never commit):

```bash
cd web && npx drizzle-kit pull && cd ../site && npm run db:pull && cd ..
```

- [ ] **Step 3: Inspect the diff** — expect ONLY the three new columns appearing in
  generated schema files. Any other drift: STOP and investigate before committing.

Run: `git diff --stat`

- [ ] **Step 4: Web + site tests and commit**

```bash
cd web && npm test && cd ../site && npm test && cd ..
git add -A && git commit -m "chore(db): apply 0008 to Neon dev, re-pull drizzle schemas (web + site)"
```

---

### Task 9: Admin — bulk route add (parser lib + preview UI + insert-only action) and core toggle

Consult `.claude/skills/yip-design-system/SKILL.md` before writing the UI (mandatory
for all Deal Desk surfaces); match `RouteForm.tsx`'s existing token idiom
(`var(--fg-3)`, `var(--font-mono)` labels, `btn btn-primary/btn-outline`, pill chips).

**Files:**
- Create: `web/src/lib/bulk-routes.ts`, `web/src/lib/bulk-routes.test.ts`, `web/src/app/(app)/config/routes/BulkRouteAdd.tsx`
- Modify: `web/src/app/config-actions.ts`, `web/src/app/(app)/config/routes/RouteForm.tsx`, `web/src/app/(app)/config/routes/page.tsx`, `web/src/components/ScanButtons.tsx`

- [ ] **Step 1: Write the failing parser tests** — `web/src/lib/bulk-routes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { parseBulkRoutes } from './bulk-routes';

const ZONES = ['MEDITERRANEAN', 'CITY_BREAKS'];

describe('parseBulkRoutes', () => {
  it('parses valid lines, uppercases, trims, optional core column', () => {
    const text = 'vno,bcn,MEDITERRANEAN\n KUN , STN , CITY_BREAKS , core \n';
    const r = parseBulkRoutes(text, ZONES);
    expect(r.issues).toEqual([]);
    expect(r.routes).toEqual([
      { origin: 'VNO', destination: 'BCN', zone: 'MEDITERRANEAN', core: false, line: 1 },
      { origin: 'KUN', destination: 'STN', zone: 'CITY_BREAKS', core: true, line: 2 },
    ]);
  });

  it('skips empty and #-comment lines', () => {
    const r = parseBulkRoutes('# header\n\nVNO,BCN,MEDITERRANEAN\n', ZONES);
    expect(r.routes).toHaveLength(1);
    expect(r.issues).toEqual([]);
  });

  it('flags bad IATA shape, unknown zone, wrong field count, in-paste dupes', () => {
    const text = [
      'VNOX,BCN,MEDITERRANEAN',          // bad origin shape
      'VNO,BCN,ATLANTIS',                // unknown zone
      'VNO,BCN',                         // too few fields
      'VNO,BCN,MEDITERRANEAN',           // ok
      'VNO,BCN,CITY_BREAKS',             // dupe of line 4
    ].join('\n');
    const r = parseBulkRoutes(text, ZONES);
    expect(r.routes).toHaveLength(1);
    expect(r.issues.map((i) => i.line)).toEqual([1, 2, 3, 5]);
    expect(r.issues[3].problem).toMatch(/duplicate/i);
  });

  it('rejects unknown core markers', () => {
    const r = parseBulkRoutes('VNO,BCN,MEDITERRANEAN,sometimes', ZONES);
    expect(r.routes).toEqual([]);
    expect(r.issues[0].problem).toMatch(/core/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run src/lib/bulk-routes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/src/lib/bulk-routes.ts`** (pure — runs client AND server):

```typescript
// Bulk route paste parser. One route per line: origin,destination,zone[,core]
// '#' lines and blank lines are skipped. Pure so the client preview and the
// server action validate identically. IATA codes are shape-checked only —
// the engine validates against fli's Airport enum at scan time.

export interface ParsedRoute {
  origin: string;
  destination: string;
  zone: string;
  core: boolean;
  line: number;
}

export interface ParseIssue {
  line: number;
  raw: string;
  problem: string;
}

export interface BulkParseResult {
  routes: ParsedRoute[];
  issues: ParseIssue[];
}

const IATA = /^[A-Z]{3}$/;
const CORE_MARKERS = new Set(['core', '1', 'true', 'yes']);

export function parseBulkRoutes(text: string, validZones: string[]): BulkParseResult {
  const zones = new Set(validZones);
  const routes: ParsedRoute[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  text.split('\n').forEach((raw, idx) => {
    const line = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const fields = trimmed.split(',').map((f) => f.trim());
    if (fields.length < 3 || fields.length > 4) {
      issues.push({ line, raw, problem: `expected 3-4 comma-separated fields, got ${fields.length}` });
      return;
    }
    const origin = fields[0].toUpperCase();
    const destination = fields[1].toUpperCase();
    const zone = fields[2];
    if (!IATA.test(origin)) return void issues.push({ line, raw, problem: `origin '${fields[0]}' is not a 3-letter IATA code` });
    if (!IATA.test(destination)) return void issues.push({ line, raw, problem: `destination '${fields[1]}' is not a 3-letter IATA code` });
    if (!zones.has(zone)) return void issues.push({ line, raw, problem: `unknown zone '${zone}'` });

    let core = false;
    if (fields.length === 4) {
      const marker = fields[3].toLowerCase();
      if (!CORE_MARKERS.has(marker)) {
        issues.push({ line, raw, problem: `unknown core marker '${fields[3]}' (use 'core')` });
        return;
      }
      core = true;
    }

    const key = `${origin}-${destination}`;
    if (seen.has(key)) {
      issues.push({ line, raw, problem: `duplicate of ${key} earlier in the paste` });
      return;
    }
    seen.add(key);
    routes.push({ origin, destination, zone, core, line });
  });

  return { routes, issues };
}
```

- [ ] **Step 4: Run parser tests**

Run: `cd web && npx vitest run src/lib/bulk-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Server action** — append to `web/src/app/config-actions.ts` (follow the
file's existing imports: `db`, `routes`, `requireAdmin`, drizzle `eq`/`and`):

```typescript
export interface BulkAddSummary {
  inserted: number;
  skippedExisting: string[];   // 'VNO-BCN' pairs already in the DB (left untouched)
  issues: { line: number; problem: string }[];
}

// Insert-only by design: existing (origin, destination) pairs are never updated,
// so founder zone edits and disabled flags are never clobbered (seeds.py property).
export async function bulkAddRoutes(form: FormData): Promise<BulkAddSummary> {
  await requireAdmin();
  const text = (form.get('routes_text') ?? '').toString();
  const zoneRows = await db.select({ zone: zones.zone }).from(zones);
  const parsed = parseBulkRoutes(text, zoneRows.map((z) => z.zone));

  const existing = await db
    .select({ origin: routes.origin, destination: routes.destination })
    .from(routes);
  const existingKeys = new Set(existing.map((r) => `${r.origin}-${r.destination}`));

  const now = new Date().toISOString();
  const skippedExisting: string[] = [];
  const fresh = parsed.routes.filter((r) => {
    const key = `${r.origin}-${r.destination}`;
    if (existingKeys.has(key)) {
      skippedExisting.push(key);
      return false;
    }
    return true;
  });

  if (fresh.length > 0) {
    await db.insert(routes).values(
      fresh.map((r) => ({
        origin: r.origin,
        destination: r.destination,
        zone: r.zone,
        core: r.core,
        enabled: true,
        cabin: 'ECONOMY',
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  revalidatePath('/config/routes');
  return {
    inserted: fresh.length,
    skippedExisting,
    issues: parsed.issues.map(({ line, problem }) => ({ line, problem })),
  };
}
```

Imports to add at the top of the file: `parseBulkRoutes` from `@/lib/bulk-routes`,
`zones` from the generated schema (check the file's existing schema import line for the
exact path), `revalidatePath` from `next/cache` (if not already imported).
ALSO: extend the existing `upsertRoute` `editableValues` with
`core: form.get('core') === 'on'` so the per-route form can edit it.

- [ ] **Step 6: UI — `web/src/app/(app)/config/routes/BulkRouteAdd.tsx`** (client
component; textarea → client-side `parseBulkRoutes` preview → confirm calls
`bulkAddRoutes`; design-system tokens as in `RouteForm.tsx`):

```tsx
'use client';

import { useState, useTransition } from 'react';
import { parseBulkRoutes } from '@/lib/bulk-routes';
import { bulkAddRoutes, type BulkAddSummary } from '@/app/config-actions';

export function BulkRouteAdd({ zones }: { zones: { zone: string }[] }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkAddSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = text.trim() ? parseBulkRoutes(text, zones.map((z) => z.zone)) : null;

  function handleAdd() {
    const form = new FormData();
    form.set('routes_text', text);
    startTransition(async () => {
      setResult(await bulkAddRoutes(form));
      setText('');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: 'var(--fg-3)' }}>
        Bulk add — one per line: origin,destination,zone[,core]
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        rows={8}
        placeholder={'VNO,FAO,MEDITERRANEAN\nKUN,DUB,CITY_BREAKS,core'}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 13, padding: '10px 12px',
                 border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)',
                 background: 'var(--bg-page)', color: 'var(--fg-1)', outline: 'none' }}
      />
      {preview && (
        <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
          {preview.routes.length} valid route{preview.routes.length === 1 ? '' : 's'} ready
          {preview.issues.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--coral-600)' }}>
              {preview.issues.map((i) => (
                <li key={i.line}>line {i.line}: {i.problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn btn-primary" disabled={isPending || !preview || preview.routes.length === 0} onClick={handleAdd}>
          {isPending ? 'Adding…' : `Add ${preview?.routes.length ?? 0} routes`}
        </button>
        {result && (
          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
            Inserted {result.inserted}
            {result.skippedExisting.length > 0 &&
              ` — skipped ${result.skippedExisting.length} existing (untouched)`}
          </span>
        )}
      </div>
    </div>
  );
}
```

Mount it in `web/src/app/(app)/config/routes/page.tsx` below the "New route" block,
inside its own `borderTop` section titled "Bulk add", passing `zones={zoneRows}`.

- [ ] **Step 7: Core chip + toggle in `RouteForm.tsx`.** In the edit-header row, next to
the enabled pill, add a core pill using the same pill styling (amber palette when core):

```tsx
          {route.core && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                           letterSpacing: '.06em', textTransform: 'uppercase',
                           padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                           background: 'var(--amber-50)', color: 'var(--amber-700)',
                           border: '1px solid var(--amber-100)', flex: 'none' }}>
              core
            </span>
          )}
```

In the edit/create form, add a labelled checkbox bound to name `core`
(`defaultChecked={route?.core ?? false}`) with helper text "Core routes scan every day;
others rotate." — `upsertRoute` already reads it after Step 5. Update the `RouteRow`
interface with `core: boolean` and check `page.tsx`'s `listRoutes()` query
(`web/src/lib/config-queries.ts`) selects the new column (drizzle re-pull from Task 8
exposes it; add it to the select if the query enumerates columns).

- [ ] **Step 8: Relabel Scan-now.** In `web/src/components/ScanButtons.tsx`, the button
that calls `handleRunScan` (~L46): change its visible label to `Scan today's cohort`
(keep the queued-toast copy). Engine-side default makes this label true.

- [ ] **Step 9: Web tests + typecheck + commit**

```bash
cd web && npm test && npx tsc --noEmit && cd ..
git add -A && git commit -m "feat(admin): bulk route add (insert-only) + core toggle + cohort scan relabel"
```

---

### Task 10: Live-DB data updates (gate values on existing template rows)

Seeds never update existing rows (Task 6 note); the live Neon dev DB needs the gate
values once. **Run after Task 8's migration apply.**

- [ ] **Step 1: Apply via psql** (URL sourced as in Task 8):

```bash
psql "$url" <<'SQL'
UPDATE deal_templates SET min_departure_dates = 5
 WHERE slug IN ('family-school-holiday-sun','september-sun','christmas-markets',
                'plan-ahead-summer','vfr-watch');
UPDATE deal_templates SET min_discount_pct = 25
 WHERE slug = 'christmas-markets' AND min_discount_pct IS NULL;
SQL
```

- [ ] **Step 2: Verify**

```bash
psql "$url" -c "SELECT slug, min_departure_dates, min_discount_pct FROM deal_templates ORDER BY slug;"
```

Expected: the five planable templates show 5; christmas-markets shows 25; last-minute,
last-warm-days, long-haul-opportunist show NULL gate. (vfr-watch / long-haul rows exist
only after `skrendam seed` runs on this DB — run `uv run skrendam seed` first with
`SKRENDAM_DATABASE_URL="$url"`, which also inserts the new routes; then
`uv run python scripts/backfill_core_routes.py` for the core flags.)

- [ ] **Step 3: Record in PR body** — the exact SQL + seed + backfill commands run, per
PR-GATE §D migration evidence. (No repo files change in this task; no commit.)

---

### Task 11: Ride-alongs — Python pin, TCC ops doc, out-of-scope register, CONTEXT.md

**Files:**
- Create: `.python-version`
- Modify: `docs/ops/daily-scan.md`, `docs/superpowers/out-of-scope.md`, `CONTEXT.md`

- [ ] **Step 1: `.python-version`** containing exactly:

```
3.13
```

(Fresh worktree venvs picked 3.14.5 on 2026-06-12 and `pydantic-core` failed to build;
this pins `uv` everywhere.) Verify: `rm -rf .venv && uv sync --all-extras && uv run python --version` → 3.13.x.

- [ ] **Step 2: TCC section in `docs/ops/daily-scan.md`** — append:

```markdown
## macOS privacy (TCC): "Operation not permitted"

If `launchd.err.log` shows `/bin/bash: …/scripts/daily-scan.sh: Operation not permitted`,
macOS is blocking launchd from reading the repo (anything under `~/Documents` is
TCC-protected; your terminal has access, launchd's bash does not). The schedule IS
firing — only the file read is denied. One-time fix, in order of preference:

1. System Settings → Privacy & Security → **Files and Folders** → `bash` →
   enable **Documents Folder** (bash appears in the list after the first denial).
2. If bash isn't listed: Privacy & Security → **Full Disk Access** → `+` → ⌘⇧G →
   `/bin/bash` → add and enable (broader grant).

Then `launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan` and check the log
ends `finished with exit 0` (or `2` = degraded — plumbing still fine).
```

- [ ] **Step 3: Out-of-scope register** — append to `docs/superpowers/out-of-scope.md`,
following the file's existing entry format, three items dated 2026-06-12 / workstream A:
degraded-day cohort requeue (log-only stance + why), mid-run periodic commits (the
2026-06-12 31-min rollback observation; cohorts shrink the window), drop-confidence
decay for stale comparisons (no calibration data yet). Also: wherever the register
marks the 06-11 initiatives (fli-resilience, multi-strategy scoring) "in brainstorm",
update to **shipped** (PR #7 / merged) — the handoff flags this stale status.

- [ ] **Step 4: CONTEXT.md vocabulary** — add entries (match the file's existing
definition style): **core route** (scans daily; `routes.core`), **tail rotation**
(computed `id % rotation_days` slice; `SKRENDAM_TAIL_ROTATION_DAYS`, default 10),
**cohort** (the set of routes due on a given day = core + today's tail slice),
**marketability gate** (`min_departure_dates` vs `departure_date_count`),
**departure date count** (near-price dates ≤110% of fare in the discovering spec's window).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: python 3.13 pin, TCC ops note, out-of-scope register + CONTEXT.md vocabulary"
```

---

### Task 12: Verification + PR

- [ ] **Step 1: Full gate**

Run: `scripts/pr-gate.sh --full`
Expected: all touched lanes (P, M, W, S — S only via re-pulled schema) green. Fix
anything red before proceeding; cold Next builds + Playwright are part of `--full`.

- [ ] **Step 2: Smoke the cohort math against the live dev DB** (read-only sanity):

```bash
url="$(grep -E '^DATABASE_URL=' /Users/superoptimised/Documents/Skrendam/web/.env.local | head -1 | cut -d= -f2- | tr -d '"')"
SKRENDAM_DATABASE_URL="$url" uv run python - <<'PY'
from datetime import date
from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.db import models
from skrendam.scanning.orchestrator import due_routes
from skrendam.scanning.resolver import resolve
from sqlalchemy import select

s = make_sessionmaker(Settings())()
routes = list(s.scalars(select(models.Route)))
tpls = list(s.scalars(select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True))))
due = due_routes(routes, date.today(), Settings().tail_rotation_days)
specs = sum(len(resolve(t, due, date.today())) for t in tpls)
print(f"routes={len(routes)} due_today={len(due)} (core={sum(1 for r in due if r.core)}) specs={specs}")
PY
```

Expected: `specs` in the 40–70 range. Materially above → flag in the PR; the founder
may want `SKRENDAM_TAIL_ROTATION_DAYS` raised before the next 06:00 run.

- [ ] **Step 3: Reviews** — `/code-review high`, then
`superpowers:requesting-code-review`; process feedback via
`superpowers:receiving-code-review`.

- [ ] **Step 4: PR** per `docs/PR-GATE.md` §D. Body must include: spec + plan links;
per-lane evidence; migration revision `0008_route_expansion` + live-apply + re-pull
confirmation; Task 10's SQL/seed/backfill commands; the founder-review items (route
list + zone rules, core picks + rationale, new-zone thresholds + calibrate note,
exclusions). After merge: remove the worktree.

---

## Self-review notes (already applied)

- Spec→task coverage: cohorts (T2), migration (T1, T8), flights cache (T3), drop
  staleness (T4), gate (T5), templates+seeds (T6, T7), bulk add + core toggle +
  relabel (T9), live-DB data (T10), ride-alongs (T11), QA (T12). Plan block: T2.
  RT trip_len test: T6. Core-composition + Airport-enum tests: T7.
- `due_routes` name, `tail_rotation_days`, `departure_date_count`,
  `min_departure_dates`, `previous_point` used consistently across tasks.
- Insert-only properties asserted in tests (T7 re-enable test, T9 action filter).
