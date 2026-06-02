# Plan 2 — Internal Curator Admin (Next.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **UI work MUST use the `yip-design-system` skill** (project memory enforces this) — build from `.claude/skills/yip-design-system/ui_kits/curator/`.

**Goal:** Build the internal curator "Deal Desk" — a Next.js app, auth-gated to a single admin, that reads the deal engine's real Postgres data and lets the founder turn the candidate queue into published deals (review → recheck → approve/publish), wired end-to-end to the live schema.

**Architecture:** A new Next.js 16 (App Router + TS) app under `web/`, deployed on Vercel, reads the engine's Postgres (Neon) via **Drizzle introspection** (`drizzle-kit pull` — the app NEVER migrates; Alembic stays the only schema owner). Because all flight fetching lives in the Python `fli` adapter, the admin triggers scans/rechecks **indirectly** via a new `scan_requests` queue table: the admin inserts a row; the existing Python worker polls and runs `run_scan()` / `recheck_candidate()`. The static `ui_kits/curator/` React demo is ported to real Next.js components fed by a `CandidateView` view-model that mirrors the demo's data shape, so components port with minimal rewrite while reading real rows.

**Tech Stack:** Next.js 16.2.7 · React 19.2.7 · TypeScript 6 · `next-auth@5.0.0-beta.31` (Auth.js v5 Credentials, single admin) · `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` (pull-only) · `@neondatabase/serverless@1.1.0` (neon-http) · `bcryptjs@3` · Playwright (E2E) · Vitest + Testing Library (component/unit). Engine side: Python 3.13, SQLAlchemy + Alembic, APScheduler (existing).

---

## Decisions locked (from the handoff + user, 2026-06-02)

1. **Cross-process scan/recheck → request-row queue.** New `scan_requests` table (Alembic-owned); admin enqueues, Python worker polls + executes. No second web service.
2. **Database → Neon now, one shared DB.** Provision Neon via Vercel Marketplace; dev against a Neon branch; engine + web share `DATABASE_URL` (web) / `SKRENDAM_DATABASE_URL` (engine, same DB).
3. **Scope → core loop first.** Auth → Today dashboard → deal queue → candidate review → **publish → published-deals** → scan-health (read). Config CRUD editors (templates/audiences/moments/routes/zones) = milestone 2 within Plan 2 (deferred to a follow-up plan section); AI-suggestions placeholder = deferred to `out-of-scope.md`.
4. **Approach → straight to this plan** (no long brainstorm; design is specified in Spec §10).

---

## Source-of-truth references (read; do NOT duplicate)

- **Curator design spec:** `docs/superpowers/specs/2026-06-01-deal-engine-curator-design.md` §6 (data model), §10 (page map / statuses / object boundaries), §11 (Spec 2 handoff), §12 (stack).
- **Engine schema (12 tables):** `skrendam/db/models.py`. Alembic-owned: `alembic/versions/0001_initial.py` (head revision `2d77c318383b`).
- **Design system (UI source of truth):** `.claude/skills/yip-design-system/` → `README.md`, `colors_and_type.css`, `ui_kits/curator/` (8 files, 510 lines: `index.html`, `App.jsx`, `Sidebar.jsx`, `Queue.jsx`, `Composer.jsx`, `Icon.jsx`, `data.js`, `curator.css`).
- **Handoff:** `docs/handoffs/2026-06-02-plan2-curator-admin.md`.

---

## Engine APIs this plan integrates with (verified signatures)

```python
# skrendam/config.py  — pydantic BaseSettings, env prefix SKRENDAM_
Settings().database_url            # env SKRENDAM_DATABASE_URL (default in-memory sqlite)
Settings().scanner_version         # "0.1.0"
Settings().min_call_interval_seconds, .pacing_jitter_seconds

# skrendam/db/session.py
def make_sessionmaker(settings: Settings | None = None)        # -> sessionmaker

# skrendam/db/base.py
class Base(DeclarativeBase): ...                               # target_metadata = Base.metadata

# skrendam/verification.py
def recheck_candidate(session, candidate: models.Candidate, adapter: FliAdapter, now: datetime) -> models.VerificationCheck
#   side effects: appends VerificationCheck; if available sets candidate.verified_at = now and candidate.price; commits.

# skrendam/scanning/orchestrator.py:40
def run_scan(session, today: date, adapter: FliAdapter, scanner_version="0.1.0", circuit_breaker_threshold=5) -> ScanSummary
#   ScanSummary fields: templates_scanned, routes_scanned, candidates_found, matches_created, errors, http_429s

# skrendam/cli.py  — backend + adapter construction pattern to mirror
def run_scan_command(session_factory=None, backend=None, today=None, seed=False) -> ScanSummary
#   builds: bucket = TokenBucket(min_call_interval_seconds, pacing_jitter_seconds); adapter = FliAdapter(backend, pace=bucket.acquire)
#   _real_backend() constructs the live fli backend.
```

**Test pattern (mirror this):** `tests/skrendam/conftest.py` provides a `session` fixture on in-memory SQLite (`Base.metadata.create_all(engine)`); flight calls are faked with an inline `FakeBackend` class (never real `fli`). New engine tests go in `tests/skrendam/`.

---

## Real-schema ↔ view-model mapping (the crux of "wired to real data")

The demo's `data.js` candidate shape is the contract the ported components already expect. We build a `CandidateView` with the **same field names**, populated from real joined rows, so components port with near-zero markup change.

| `CandidateView` field | Source (real schema) |
|---|---|
| `id` | `candidates.id` (stringified) |
| `score` | `candidate_template_matches.match_score × 100`, rounded (DB stores 0–1) |
| `status` | display status from `candidates.status` (+ published_deal existence) — see `lib/status.ts` |
| `from` / `to` | `candidates.origin` / `candidates.destination` (IATA) |
| `origin` / `place` / `country` | city/country via `lib/airports.ts` IATA map (fallback = IATA) |
| `price` / `usual` / `drop` | `candidates.price` / `candidates.baseline_price` / `candidates.discount_pct` |
| `dates` | format `candidates.travel_date` (+ `return_date`) via `lib/format.ts` |
| `legs` / `airline` | derived from `candidates.itinerary_snapshot` JSON (graceful fallback `"—"`) |
| `template` | `deal_templates.public_label ?? deal_templates.name` |
| `signals` | `candidate_template_matches.reason_text` + derived (`{drop}% below baseline`, `Direct` if 0 stops) |
| `flags` | derived from `itinerary_snapshot` + `candidate_template_matches.gate_results` (stops, late arrival, self-transfer) |
| `grad` | deterministic per `candidates.zone` via `lib/gradients.ts` (on-brand amber/sea) |
| `copy.headline` / `.hook` / `.news` | `content_drafts.headline` / `.tiktok_hook` / `.newsletter_snippet` |

**Display-status mapping (`lib/status.ts`):** `new → "suggested"`; `seen|maybe → "review"`; `rejected → "rejected"`; `approved|edited OR has published_deal → "published"`; `expired → "expired"`.

---

## File structure

**Engine (Python) — additive, Alembic-owned:**
- Modify `skrendam/db/models.py` — add `ScanRequest`.
- Create `alembic/versions/0002_scan_requests.py` — migration (down_revision `2d77c318383b`).
- Create `skrendam/worker.py` — `process_pending_requests()` + `poll_loop()`.
- Modify `skrendam/cli.py` — add `worker` subcommand + `enqueue` helper used by tests.
- Create `tests/skrendam/test_worker.py`.

**Web (`web/`) — new Next.js app:**
```
web/
  package.json  tsconfig.json  next.config.ts  eslint.config.mjs  .gitignore  .env.example
  drizzle.config.ts                       # pull-only
  playwright.config.ts
  src/
    auth.config.ts  auth.ts  proxy.ts     # Auth.js v5 split config + Next 16 route protection
    db/
      index.ts                            # drizzle(neon-http) client
      generated/{schema.ts,relations.ts}  # GENERATED by drizzle-kit pull (committed)
    lib/
      queries.ts mappers.ts format.ts airports.ts status.ts gradients.ts
      types.ts                            # CandidateView, ScanView, etc.
    components/
      Icon.tsx Wordmark.tsx Sidebar.tsx Topbar.tsx
      Queue.tsx QueueRow.tsx ScoreBadge.tsx StatusPill.tsx
      Composer.tsx CopyDrafter.tsx
    app/
      layout.tsx globals.css page.tsx     # page.tsx = Today dashboard
      login/page.tsx
      api/auth/[...nextauth]/route.ts
      queue/page.tsx
      candidates/[id]/page.tsx
      published/page.tsx
      scans/page.tsx
      actions.ts                          # 'use server' mutations
    styles/{colors_and_type.css,curator.css}   # copied from the skill
  e2e/journey.spec.ts
```

---

## Prerequisites (one-time, before Task 6)

These are partly interactive (Vercel/Neon dashboard or CLI). Document outcomes in the PR.

- [ ] Provision **Neon Postgres** via Vercel Marketplace (or Neon directly), creating one project with a `dev` branch.
- [ ] Capture both connection strings: **pooled** (`...-pooler...`) and **direct/unpooled**.
- [ ] Run the engine once against the Neon **dev** DB to populate real data:
  ```bash
  SKRENDAM_DATABASE_URL='<neon direct url>' uv run alembic upgrade head
  SKRENDAM_DATABASE_URL='<neon direct url>' uv run skrendam run-scan --seed
  ```
  (Engine needs Python ≤3.13 via `uv`.) Confirm rows exist: `candidates`, `candidate_template_matches`, `deal_templates`, `scan_runs`.

---

# Milestone A — Engine: `scan_requests` queue (Python, TDD)

Adds the cross-process trigger. Pure engine work; follows existing patterns and tests on in-memory SQLite.

### Task 1: `ScanRequest` model + Alembic migration

**Files:**
- Modify: `skrendam/db/models.py` (append new class)
- Create: `alembic/versions/0002_scan_requests.py`
- Test: `tests/skrendam/test_worker.py`

- [ ] **Step 1: Write the failing test** (model + table create)

Create `tests/skrendam/test_worker.py`:
```python
from datetime import datetime

from skrendam.db import models


def test_scan_request_defaults(session):
    req = models.ScanRequest(kind="full_scan")
    session.add(req)
    session.commit()
    assert req.id is not None
    assert req.status == "queued"
    assert req.requested_by == "curator"
    assert req.created_at is not None
    assert req.candidate_id is None
```

- [ ] **Step 2: Run it; verify it fails**

Run: `uv run pytest tests/skrendam/test_worker.py::test_scan_request_defaults -v`
Expected: FAIL — `AttributeError: module 'skrendam.db.models' has no attribute 'ScanRequest'`.

- [ ] **Step 3: Add the model**

Append to `skrendam/db/models.py`:
```python
class ScanRequest(Base):
    __tablename__ = "scan_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String)  # "full_scan" | "recheck"
    candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidates.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="queued", index=True)
    requested_by: Mapped[str] = mapped_column(String, default="curator")
    params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 4: Run it; verify it passes**

Run: `uv run pytest tests/skrendam/test_worker.py::test_scan_request_defaults -v`
Expected: PASS.

- [ ] **Step 5: Generate the Alembic migration**

Run (against any reachable DB; SQLite default is fine for autogenerate of a new table):
```bash
uv run alembic revision --autogenerate -m "add scan_requests queue table"
```
Then **rename** the generated file to match the repo convention → `alembic/versions/0002_scan_requests.py`, and confirm inside it:
```python
revision = "<generated-hex>"
down_revision = "2d77c318383b"
```
The `upgrade()` must `op.create_table("scan_requests", ...)` with the columns above (id PK, kind, candidate_id FK→candidates.id nullable, status indexed, requested_by, params JSON, result_summary JSON, error Text, created_at indexed, started_at, finished_at). `downgrade()` drops the table and its indexes. Verify autogenerate captured the two indexes (`status`, `created_at`); add `op.create_index(...)` manually if missing.

- [ ] **Step 6: Verify the migration applies cleanly**

Run:
```bash
SKRENDAM_DATABASE_URL='sqlite+pysqlite:///tmp_mig_check.db' uv run alembic upgrade head
SKRENDAM_DATABASE_URL='sqlite+pysqlite:///tmp_mig_check.db' uv run alembic downgrade -1
rm -f tmp_mig_check.db
```
Expected: upgrade then downgrade with no errors.

- [ ] **Step 7: Commit**
```bash
git add skrendam/db/models.py alembic/versions/0002_scan_requests.py tests/skrendam/test_worker.py
git commit -m "feat(skrendam): scan_requests queue table + migration"
```

### Task 2: `worker.process_pending_requests()`

Claims queued requests, runs the right engine call, records result. Synchronous + testable (no loop).

**Files:**
- Create: `skrendam/worker.py`
- Test: `tests/skrendam/test_worker.py` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/skrendam/test_worker.py`:
```python
from datetime import date

from skrendam.fli_adapter.adapter import FliAdapter
from skrendam import worker


class FakeBackend:
    """Mimics the live fli backend surface used by recheck/run_scan."""
    def __init__(self, fares=None):
        self._fares = fares if fares is not None else [
            {"price": 41.0, "currency": "EUR", "booking_url": "https://x", "stops": 0}
        ]

    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        return list(self._fares)

    def search_dates(self, *a, **k):
        return []


def _adapter(fares=None):
    return FliAdapter(FakeBackend(fares), pace=lambda: None)


def _seed_candidate(session):
    session.add(models.Route(id=1, origin="VNO", destination="LCA", zone="MED"))
    cand = models.Candidate(
        id=1, route_id=1, origin="VNO", destination="LCA", zone="MED",
        trip_type="oneway", travel_date=date(2026, 10, 14), price=59.0,
        currency="EUR", status="new", deal_group_key="VNO|LCA|oneway|2026-10-14|59",
        search_params={"cabin": "ECONOMY"},
    )
    session.add(cand)
    session.commit()
    return cand


def test_recheck_request_runs_and_marks_done(session):
    cand = _seed_candidate(session)
    req = models.ScanRequest(kind="recheck", candidate_id=cand.id)
    session.add(req)
    session.commit()

    n = worker.process_pending_requests(
        session, _adapter(), today=date(2026, 6, 2), now=datetime(2026, 6, 2, 8, 0)
    )
    assert n == 1
    session.refresh(req)
    assert req.status == "done"
    assert req.started_at == datetime(2026, 6, 2, 8, 0)
    assert req.finished_at is not None
    assert req.result_summary["available"] is True
    assert session.query(models.VerificationCheck).count() == 1


def test_recheck_missing_candidate_marks_error(session):
    req = models.ScanRequest(kind="recheck", candidate_id=999)
    session.add(req)
    session.commit()
    worker.process_pending_requests(
        session, _adapter(), today=date(2026, 6, 2), now=datetime(2026, 6, 2, 8, 0)
    )
    session.refresh(req)
    assert req.status == "error"
    assert "999" in (req.error or "")


def test_only_queued_are_claimed_and_limit_respected(session):
    _seed_candidate(session)
    for _ in range(3):
        session.add(models.ScanRequest(kind="recheck", candidate_id=1))
    session.add(models.ScanRequest(kind="recheck", candidate_id=1, status="done"))
    session.commit()
    n = worker.process_pending_requests(
        session, _adapter(), today=date(2026, 6, 2),
        now=datetime(2026, 6, 2, 8, 0), limit=2,
    )
    assert n == 2  # only 2 of the 3 queued, none of the done
    assert session.query(models.ScanRequest).filter_by(status="queued").count() == 1
```
(Add `from datetime import datetime` and `from skrendam.db import models` at the top if not already imported.)

- [ ] **Step 2: Run; verify they fail**

Run: `uv run pytest tests/skrendam/test_worker.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'skrendam.worker'`.

- [ ] **Step 3: Implement `skrendam/worker.py`**
```python
"""Cross-process request queue: the Next.js admin enqueues ScanRequest rows;
this worker (polled by the scheduler) executes them via the Python fli stack."""

from __future__ import annotations

import time
from datetime import date, datetime

from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.scanning.orchestrator import run_scan
from skrendam.verification import recheck_candidate


def process_pending_requests(
    session: Session,
    adapter,
    *,
    today: date,
    now: datetime,
    scanner_version: str = "0.1.0",
    limit: int = 5,
) -> int:
    """Claim up to `limit` queued scan_requests (oldest first) and execute each.

    Returns the number of requests processed. Errors on a single request are
    recorded on the row (status="error") and never abort the batch.
    """
    pending = (
        session.query(models.ScanRequest)
        .filter(models.ScanRequest.status == "queued")
        .order_by(models.ScanRequest.created_at)
        .limit(limit)
        .all()
    )
    processed = 0
    for req in pending:
        req.status = "running"
        req.started_at = now
        session.commit()
        try:
            if req.kind == "recheck":
                cand = session.get(models.Candidate, req.candidate_id)
                if cand is None:
                    raise ValueError(f"candidate {req.candidate_id} not found")
                check = recheck_candidate(session, cand, adapter, now)
                req.result_summary = {"available": check.available, "price": check.price}
            elif req.kind == "full_scan":
                summary = run_scan(
                    session, today=today, adapter=adapter, scanner_version=scanner_version
                )
                req.result_summary = {
                    "candidates_found": summary.candidates_found,
                    "matches_created": summary.matches_created,
                    "errors": summary.errors,
                }
            else:
                raise ValueError(f"unknown kind {req.kind!r}")
            req.status = "done"
        except Exception as exc:  # noqa: BLE001 — record and continue
            req.status = "error"
            req.error = str(exc)
        finally:
            req.finished_at = now
            session.commit()
        processed += 1
    return processed


def poll_loop(
    make_session,
    make_adapter,
    *,
    interval_seconds: float = 15.0,
    scanner_version: str = "0.1.0",
    now_fn=datetime.utcnow,
    today_fn=date.today,
    stop=None,
) -> None:
    """Run process_pending_requests forever (or until stop() is truthy)."""
    while not (stop and stop()):
        session = make_session()
        try:
            process_pending_requests(
                session,
                make_adapter(),
                today=today_fn(),
                now=now_fn(),
                scanner_version=scanner_version,
            )
        finally:
            session.close()
        if stop and stop():
            break
        time.sleep(interval_seconds)
```

- [ ] **Step 4: Run; verify pass**

Run: `uv run pytest tests/skrendam/test_worker.py -v`
Expected: PASS (all worker tests).

- [ ] **Step 5: Commit**
```bash
git add skrendam/worker.py tests/skrendam/test_worker.py
git commit -m "feat(skrendam): worker.process_pending_requests for scan_requests queue"
```

### Task 3: `poll_loop` test + `skrendam worker` CLI command

**Files:**
- Modify: `skrendam/cli.py`
- Test: `tests/skrendam/test_worker.py` (extend)

- [ ] **Step 1: Write the failing test** (poll_loop processes then stops)

Append to `tests/skrendam/test_worker.py`:
```python
def test_poll_loop_processes_one_batch_then_stops(session, monkeypatch):
    _seed_candidate(session)
    session.add(models.ScanRequest(kind="recheck", candidate_id=1))
    session.commit()

    monkeypatch.setattr(worker.time, "sleep", lambda s: None)
    calls = {"n": 0}

    def stop():
        calls["n"] += 1
        return calls["n"] > 1  # allow exactly one iteration

    worker.poll_loop(
        make_session=lambda: session,
        make_adapter=_adapter,
        interval_seconds=0,
        now_fn=lambda: datetime(2026, 6, 2, 8, 0),
        today_fn=lambda: date(2026, 6, 2),
        stop=stop,
    )
    assert session.query(models.ScanRequest).filter_by(status="done").count() == 1
```

- [ ] **Step 2: Run; verify it passes** (poll_loop already implemented in Task 2)

Run: `uv run pytest tests/skrendam/test_worker.py::test_poll_loop_processes_one_batch_then_stops -v`
Expected: PASS. (If it hangs, the `stop` wiring in `poll_loop` is wrong — fix so `stop()` is checked before sleeping and at loop top.)

- [ ] **Step 3: Add the `worker` CLI subcommand**

In `skrendam/cli.py`, add a command that mirrors `run_scan_command`'s adapter construction and calls `poll_loop`:
```python
def worker_command() -> None:
    """Run the request-queue poller (blocks). Used by the always-on worker host."""
    from skrendam.config import Settings
    from skrendam.db.session import make_sessionmaker
    from skrendam.fli_adapter.adapter import FliAdapter
    from skrendam.fli_adapter.pacing import TokenBucket
    from skrendam.worker import poll_loop

    settings = Settings()
    make_session = make_sessionmaker(settings)
    backend = _real_backend()

    def make_adapter():
        bucket = TokenBucket(
            settings.min_call_interval_seconds, settings.pacing_jitter_seconds
        )
        return FliAdapter(backend, pace=bucket.acquire)

    poll_loop(make_session, make_adapter, scanner_version=settings.scanner_version)
```
Register it in `main()`'s subparsers next to `run-scan`/`seed`/`calibrate`:
```python
    sub.add_parser("worker")
    ...
    elif args.cmd == "worker":
        worker_command()
```
(Confirm the exact import paths for `TokenBucket`/`_real_backend` against the current `cli.py`; reuse whatever it already imports.)

- [ ] **Step 4: Smoke-run the help**

Run: `uv run skrendam worker --help` (Ctrl-C is not needed for --help)
Expected: argparse shows `worker` as a valid subcommand (no traceback).

- [ ] **Step 5: Full engine suite still green + mypy**
```bash
uv run pytest -q
uv run mypy skrendam
```
Expected: all pass; mypy clean (matches existing standard).

- [ ] **Step 6: Commit**
```bash
git add skrendam/cli.py tests/skrendam/test_worker.py
git commit -m "feat(skrendam): 'skrendam worker' poll-loop command"
```

---

# Milestone B — Next.js foundations

Scaffold, design tokens, DB introspection, auth, and the auth-gated app shell.

### Task 4: Scaffold the Next.js app + dependencies

**Files:** create `web/` (via generator), then `web/.gitignore`, root `.gitignore` additions.

- [ ] **Step 1: Scaffold** (run from repo root)
```bash
npx create-next-app@latest web \
  --typescript --app --src-dir --eslint --use-npm \
  --no-tailwind --no-turbopack --import-alias "@/*"
```
Accept defaults for any remaining prompts. This creates `web/` with `src/app/`.

- [ ] **Step 2: Pin runtime deps (exact versions)**
```bash
cd web
npm i next@16.2.7 react@19.2.7 react-dom@19.2.7 \
  next-auth@5.0.0-beta.31 \
  drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0 \
  bcryptjs@3.0.3 zod lucide-react
npm i -D typescript@^6 drizzle-kit@0.31.10 @types/node @types/react @types/react-dom @types/bcryptjs
cd ..
```

- [ ] **Step 3: Add web ignores to the root `.gitignore`**

Append to `/Users/superoptimised/Documents/Skrendam/.gitignore`:
```gitignore
# Next.js curator admin (web/)
web/node_modules/
web/.next/
web/out/
web/.env*.local
web/playwright-report/
web/test-results/
```
(Keep `web/src/db/generated/` **tracked** — the introspected schema is committed.)

- [ ] **Step 4: Verify it builds + dev-runs**
```bash
cd web && npm run build && cd ..
```
Expected: a clean production build of the starter app.

- [ ] **Step 5: Commit**
```bash
git add web .gitignore
git commit -m "chore(web): scaffold Next.js 16 curator admin app"
```

### Task 5: Design tokens, globals, and the app shell layout

Copy the design system into the app and wire global CSS. **Use the `yip-design-system` skill.**

**Files:**
- Create: `web/src/styles/colors_and_type.css` (copy), `web/src/styles/curator.css` (copy + adapt)
- Create/Modify: `web/src/app/globals.css`, `web/src/app/layout.tsx`

- [ ] **Step 1: Copy the tokens + curator CSS verbatim**
```bash
cp .claude/skills/yip-design-system/colors_and_type.css web/src/styles/colors_and_type.css
cp .claude/skills/yip-design-system/ui_kits/curator/curator.css web/src/styles/curator.css
```

- [ ] **Step 2: Wire fonts + global CSS in `web/src/app/globals.css`**

Replace the starter `globals.css` with:
```css
/* Bricolage Grotesque (display), Hanken Grotesk (body), Space Mono (mono) */
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
@import '../styles/colors_and_type.css';
@import '../styles/curator.css';

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg-page);
  color: var(--fg-1);
  font-family: var(--font-body), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
```
(The fonts all support Lithuanian diacritics — no per-locale change needed, per the design system.)

- [ ] **Step 3: Root layout** `web/src/app/layout.tsx`
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yip · Deal Desk',
  description: 'Internal curator admin for Yip flight deals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the dev server renders with brand styles**
```bash
cd web && npm run dev
```
Visit http://localhost:3000 — confirm cream background + fonts load (no console errors). Stop the server.

- [ ] **Step 5: Commit**
```bash
git add web/src/styles web/src/app/globals.css web/src/app/layout.tsx
git commit -m "feat(web): import yip design tokens + curator css + base layout"
```

### Task 6: Neon connection + Drizzle introspection + db client

**Files:** `web/drizzle.config.ts`, `web/.env.example`, `web/.env.local` (gitignored), `web/src/db/index.ts`, generated `web/src/db/generated/*`.

- [ ] **Step 1: `web/.env.example`** (commit this; real values go in `.env.local`)
```bash
# Pooled Neon URL (host contains -pooler) — used by the app at runtime
DATABASE_URL=
# Direct/unpooled Neon URL — used ONLY by drizzle-kit pull (introspection)
DATABASE_URL_UNPOOLED=
# Auth.js
AUTH_SECRET=
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
AUTH_TRUST_HOST=true
```
Create `web/.env.local` with the real Neon dev values + a generated `AUTH_SECRET` (`cd web && npx auth secret`) + a bcrypt hash (Task 7, Step 1).

- [ ] **Step 2: `web/drizzle.config.ts` (pull-only)**
```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/db/generated',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  schemaFilter: ['public'],
});
```

- [ ] **Step 3: Introspect the live (seeded) Neon DB**
```bash
cd web && npx drizzle-kit pull && cd ..
```
Expected: generates `web/src/db/generated/schema.ts` (all 13 tables incl. `scan_requests`), `relations.ts`, and `meta/`. Open `schema.ts` and confirm exports for `candidates`, `candidateTemplateMatches`, `dealTemplates`, `publishedDeals`, `contentDrafts`, `verificationChecks`, `scanRuns`, `scanRequests`. **Note the exact exported identifiers** — later tasks must match them.

- [ ] **Step 4: db client** `web/src/db/index.ts`
```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './generated/schema';
import * as relations from './generated/relations';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema: { ...schema, ...relations } });

export * from './generated/schema';
```

- [ ] **Step 5: Typecheck**
```bash
cd web && npx tsc --noEmit && cd ..
```
Expected: no type errors (generated schema + client compile).

- [ ] **Step 6: Commit**
```bash
git add web/drizzle.config.ts web/.env.example web/src/db
git commit -m "feat(web): drizzle-kit pull introspection + neon-http db client"
```

### Task 7: Auth.js v5 single-admin Credentials + route protection

**Files:** `web/src/auth.config.ts`, `web/src/auth.ts`, `web/src/proxy.ts`, `web/src/app/api/auth/[...nextauth]/route.ts`, `web/src/app/login/page.tsx`.

- [ ] **Step 1: Generate the admin password hash** (one-time; paste into `.env.local`)
```bash
cd web && node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'YOUR_ADMIN_PASSWORD' && cd ..
```
Put the output in `ADMIN_PASSWORD_HASH` and set `ADMIN_USERNAME` in `web/.env.local`.

- [ ] **Step 2: `web/src/auth.config.ts`** (edge-safe; no bcrypt/db)
```ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (nextUrl.pathname === '/login') return true;
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
```

- [ ] **Step 3: `web/src/auth.ts`** (Node runtime; Credentials + bcrypt)
```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const parsed = schema.safeParse(credentials);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
        const expectedUser = process.env.ADMIN_USERNAME;
        const expectedHash = process.env.ADMIN_PASSWORD_HASH;
        if (!expectedUser || !expectedHash) return null;
        const passwordOk = await bcrypt.compare(password, expectedHash);
        if (!passwordOk || username !== expectedUser) return null;
        return { id: 'admin', name: expectedUser };
      },
    }),
  ],
});
```

- [ ] **Step 4: Route handler** `web/src/app/api/auth/[...nextauth]/route.ts`
```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 5: `web/src/proxy.ts`** (Next 16 route protection — Node runtime)
```ts
import { auth } from '@/auth';

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== '/login') {
    return Response.redirect(new URL('/login', req.nextUrl.origin));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Login page** `web/src/app/login/page.tsx` (server action calls `signIn`)
```tsx
import { signIn } from '@/auth';
import { Wordmark } from '@/components/Wordmark';

export default function LoginPage() {
  async function login(formData: FormData) {
    'use server';
    await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirectTo: '/',
    });
  }
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form action={login} className="card" style={{ width: 320, padding: 28, display: 'grid', gap: 12 }}>
        <Wordmark size={34} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '4px 0 8px' }}>Deal Desk</h1>
        <input name="username" placeholder="Username" autoComplete="username" className="draftbox" />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" className="draftbox" />
        <button type="submit" className="btn btn-primary">Sign in</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Verify auth gate works**

With `web/.env.local` populated, run `cd web && npm run dev`:
- Visit `/` → should redirect to `/login`.
- Submit wrong creds → stays on login (no crash).
- Submit correct creds → redirects to `/` (currently the starter page).
Stop the server.

- [ ] **Step 8: Commit**
```bash
git add web/src/auth.config.ts web/src/auth.ts web/src/proxy.ts web/src/app/api web/src/app/login
git commit -m "feat(web): Auth.js v5 single-admin credentials + proxy route protection"
```

### Task 8: Port the static chrome — Icon, Wordmark, Sidebar

Port the always-present shell from `ui_kits/curator/`. **Use the `yip-design-system` skill;** keep `curator.css` class names so styles apply unchanged.

**Files:** `web/src/components/Icon.tsx`, `Wordmark.tsx`, `Sidebar.tsx`; modify `web/src/app/layout.tsx` to render the shell for authed pages (via a route group or a shared layout).

- [ ] **Step 1: `Icon.tsx`** — replace the demo's CDN-Lucide imperative renderer with `lucide-react`:
```tsx
import * as icons from 'lucide-react';

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2 }: {
  name: keyof typeof icons; size?: number; color?: string; strokeWidth?: number;
}) {
  const Cmp = icons[name] as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  return Cmp ? <Cmp size={size} color={color} strokeWidth={strokeWidth} /> : null;
}
```

- [ ] **Step 2: `Wordmark.tsx`** — port `Wordmark` from `ui_kits/curator/Icon.jsx` (the typographic `yıp` mark, dotless ı, amber bead), as a TSX component using `var(--logo-ink)`. Keep markup/classes identical to the kit.

- [ ] **Step 3: `Sidebar.tsx`** — port `Sidebar` from `ui_kits/curator/Sidebar.jsx`. Convert to TSX. Make nav items real `<Link>`s (next/link): Queue→`/queue`, Published→`/published`, Insights/Scan→`/scans`, plus Templates/Audience/Settings as disabled placeholders (milestone 2). Use `usePantname` (`'use client'`) to set the active class. Keep `.side`, `.navi`, `.badge` classes. Render `<Wordmark/>` and the curator profile card as in the kit (curator name from a constant for now).

- [ ] **Step 4: Authed shell layout** — create `web/src/app/(app)/layout.tsx` route group that renders `<Sidebar/>` + `<main className="main">{children}</main>`, and move authed pages under `(app)/`. The `/login` page stays outside the group. (Alternatively keep a single layout that conditionally renders the sidebar; route group is cleaner.)

- [ ] **Step 5: Temporary dashboard placeholder** — `web/src/app/(app)/page.tsx`:
```tsx
export default function Dashboard() {
  return <div className="topbar"><h1 style={{ fontFamily: 'var(--font-display)' }}>Today</h1></div>;
}
```

- [ ] **Step 6: Verify the shell renders authed**

`cd web && npm run dev`, sign in, confirm: sidebar with Yip wordmark + nav, active highlight on the current route, cream canvas, no console errors. Stop server.

- [ ] **Step 7: Typecheck + lint + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/components web/src/app
git commit -m "feat(web): port Icon/Wordmark/Sidebar shell + authed route-group layout"
```

---

# Milestone C — Read views, wired to real data

Build the view-model + queries first (unit-tested), then port the presentational components and assemble the pages as server components.

### Task 9: View-model types, pure helpers, queries + mappers

Pure functions get Vitest unit tests (TDD); the Drizzle queries are exercised by the Playwright E2E in Milestone E.

**Files:** `web/src/lib/types.ts`, `format.ts`, `airports.ts`, `status.ts`, `gradients.ts`, `queries.ts`, `mappers.ts`; test setup `web/vitest.config.ts`, `web/src/lib/*.test.ts`.

- [ ] **Step 1: Add Vitest**
```bash
cd web && npm i -D vitest && cd ..
```
Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```
Add to `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write failing tests for the pure helpers**

`web/src/lib/status.test.ts`:
```ts
import { expect, test } from 'vitest';
import { toDisplayStatus } from './status';

test('maps engine status + publish state to display status', () => {
  expect(toDisplayStatus('new', false)).toBe('suggested');
  expect(toDisplayStatus('seen', false)).toBe('review');
  expect(toDisplayStatus('maybe', false)).toBe('review');
  expect(toDisplayStatus('rejected', false)).toBe('rejected');
  expect(toDisplayStatus('approved', false)).toBe('published');
  expect(toDisplayStatus('new', true)).toBe('published'); // published_deal exists
  expect(toDisplayStatus('expired', false)).toBe('expired');
});
```
`web/src/lib/format.test.ts`:
```ts
import { expect, test } from 'vitest';
import { formatDates, pct } from './format';

test('formats one-way and round-trip date ranges', () => {
  expect(formatDates('2026-10-14', null)).toBe('14 Oct');
  expect(formatDates('2026-10-14', '2026-10-21')).toBe('14–21 Oct');
});
test('pct rounds to whole percent', () => {
  expect(pct(0.42)).toBe(42);
  expect(pct(null)).toBe(0);
});
```

- [ ] **Step 3: Run; verify fail**

Run: `cd web && npm test`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the helpers**

`web/src/lib/types.ts`:
```ts
export type DisplayStatus = 'suggested' | 'review' | 'rejected' | 'published' | 'expired';

export interface CandidateView {
  id: string;
  candidateId: number;
  templateId: number;
  matchId: number;
  score: number;            // 0–100
  status: DisplayStatus;
  place: string; country: string; origin: string;
  from: string; to: string;
  price: number; usual: number | null; drop: number;
  dates: string; legs: string; airline: string;
  template: string;
  signals: string[]; flags: string[];
  grad: string;
  verifiedAt: string | null;
  copy: { headline: string; hook: string; news: string };
}

export interface ScanView { fares: string; airports: number; ago: string; newToday: number; status: string; }
export interface TemplateGroup { templateId: number; templateLabel: string; items: CandidateView[]; }
```
`web/src/lib/status.ts`:
```ts
import type { DisplayStatus } from './types';
export function toDisplayStatus(engineStatus: string, hasPublishedDeal: boolean): DisplayStatus {
  if (hasPublishedDeal || engineStatus === 'approved' || engineStatus === 'edited') return 'published';
  if (engineStatus === 'rejected') return 'rejected';
  if (engineStatus === 'expired') return 'expired';
  if (engineStatus === 'seen' || engineStatus === 'maybe') return 'review';
  return 'suggested'; // "new"
}
```
`web/src/lib/format.ts`:
```ts
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }
export function formatDates(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.day} ${a.mon}`;
  const b = d(ret);
  return a.mon === b.mon ? `${a.day}–${b.day} ${a.mon}` : `${a.day} ${a.mon}–${b.day} ${b.mon}`;
}
export function pct(v: number | null | undefined): number { return v == null ? 0 : Math.round(v * 100); }
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
```
`web/src/lib/airports.ts`:
```ts
// Minimal IATA → {city, country} map for the origins/destinations the engine scans.
// Extend as routes grow; falls back to the IATA code.
const A: Record<string, { city: string; country: string }> = {
  VNO: { city: 'Vilnius', country: 'Lithuania' }, KUN: { city: 'Kaunas', country: 'Lithuania' },
  RIX: { city: 'Riga', country: 'Latvia' }, PLQ: { city: 'Palanga', country: 'Lithuania' },
  LCA: { city: 'Larnaca', country: 'Cyprus' }, BCN: { city: 'Barcelona', country: 'Spain' },
  // … add the seeded destinations from skrendam/seeds.py
};
export function city(iata: string): string { return A[iata]?.city ?? iata; }
export function country(iata: string): string { return A[iata]?.country ?? ''; }
```
`web/src/lib/gradients.ts`:
```ts
// Deterministic, on-brand card gradient per zone (real data has no gradient field).
const G: Record<string, string> = {
  MEDITERRANEAN: 'linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)',
  CANARIES: 'linear-gradient(150deg,#F2B84B,#E06A1F 70%,#9C520A)',
  WESTERN_EUROPE: 'linear-gradient(150deg,#3FB3A6,#1F7A86 70%,#0E4C52)',
  SCANDINAVIA: 'linear-gradient(150deg,#7FC9C0,#2E8E93 70%,#15585E)',
  CITY_BREAKS: 'linear-gradient(150deg,#E9A23B,#C2531E 70%,#7E3D12)',
};
export function gradientForZone(zone: string | null): string {
  return (zone && G[zone]) || 'linear-gradient(150deg,#EFA227,#C2531E 70%,#7E3D12)';
}
```

- [ ] **Step 5: Run; verify helper tests pass**

Run: `cd web && npm test`
Expected: PASS (status + format suites).

- [ ] **Step 6: Queries** `web/src/lib/queries.ts` (verify identifiers against `db/generated/schema.ts`)
```ts
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidates, candidateTemplateMatches, dealTemplates, contentDrafts,
  publishedDeals, scanRuns,
} from '@/db/generated/schema';

export async function getQueueRows() {
  return db
    .select({
      matchId: candidateTemplateMatches.id,
      score: candidateTemplateMatches.matchScore,
      reason: candidateTemplateMatches.reasonText,
      gates: candidateTemplateMatches.gateResults,
      templateId: dealTemplates.id,
      templateLabel: dealTemplates.publicLabel,
      templateName: dealTemplates.name,
      headline: contentDrafts.headline,
      hook: contentDrafts.tiktokHook,
      news: contentDrafts.newsletterSnippet,
      publishedId: publishedDeals.id,
      c: candidates,
    })
    .from(candidateTemplateMatches)
    .innerJoin(candidates, eq(candidateTemplateMatches.candidateId, candidates.id))
    .innerJoin(dealTemplates, eq(candidateTemplateMatches.dealTemplateId, dealTemplates.id))
    .leftJoin(contentDrafts, and(
      eq(contentDrafts.candidateId, candidates.id),
      eq(contentDrafts.dealTemplateId, dealTemplates.id),
    ))
    .leftJoin(publishedDeals, eq(publishedDeals.candidateId, candidates.id))
    .orderBy(desc(candidateTemplateMatches.matchScore));
}

export async function getCandidateRow(matchId: number) {
  const rows = await getQueueRows();
  return rows.find((r) => r.matchId === matchId) ?? null;
}

export async function getLatestScanRun() {
  const [run] = await db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(1);
  return run ?? null;
}

export async function getPublishedDeals() {
  return db.select().from(publishedDeals).orderBy(desc(publishedDeals.publishedAt));
}
```

- [ ] **Step 7: Mapper** `web/src/lib/mappers.ts`
```ts
import type { CandidateView, ScanView, TemplateGroup } from './types';
import { city, country } from './airports';
import { formatDates, pct, timeAgo } from './format';
import { gradientForZone } from './gradients';
import { toDisplayStatus } from './status';

type QueueRow = Awaited<ReturnType<typeof import('./queries').getQueueRows>>[number];

function legsFrom(snapshot: unknown): { legs: string; airline: string; stops: number } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const stops = Number(s.stops ?? 0);
  const dur = s.duration_minutes ? `${Math.round(Number(s.duration_minutes) / 60)}h` : '';
  const legs = `${stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}${dur ? ` · ${dur}` : ''}`;
  return { legs, airline: String(s.airline ?? '—'), stops };
}

export function toCandidateView(r: QueueRow): CandidateView {
  const c = r.c;
  const { legs, airline, stops } = legsFrom(c.itinerarySnapshot);
  const drop = pct(c.discountPct);
  const signals = [
    ...(r.reason ? [r.reason] : []),
    ...(drop ? [`${drop}% below baseline`] : []),
    ...(stops === 0 ? ['Direct route'] : []),
  ];
  const flags: string[] = [];
  if (stops >= 2) flags.push('2+ stops');
  if ((c.itinerarySnapshot as any)?.self_transfer) flags.push('Self-transfer');
  return {
    id: `m${r.matchId}`, candidateId: c.id, templateId: r.templateId, matchId: r.matchId,
    score: Math.round(Number(r.score) * 100),
    status: toDisplayStatus(c.status, r.publishedId != null),
    place: city(c.destination), country: country(c.destination), origin: city(c.origin),
    from: c.origin, to: c.destination,
    price: Number(c.price), usual: c.baselinePrice == null ? null : Number(c.baselinePrice), drop,
    dates: formatDates(String(c.travelDate), c.returnDate ? String(c.returnDate) : null),
    legs, airline,
    template: r.templateLabel ?? r.templateName,
    signals, flags,
    grad: gradientForZone(c.zone),
    verifiedAt: c.verifiedAt ? String(c.verifiedAt) : null,
    copy: { headline: r.headline ?? '', hook: r.hook ?? '', news: r.news ?? '' },
  };
}

export function groupByTemplate(rows: QueueRow[]): TemplateGroup[] {
  const map = new Map<number, TemplateGroup>();
  for (const r of rows) {
    const v = toCandidateView(r);
    const g = map.get(r.templateId) ?? { templateId: r.templateId, templateLabel: v.template, items: [] };
    g.items.push(v); map.set(r.templateId, g);
  }
  return [...map.values()];
}

export function toScanView(run: any | null): ScanView {
  if (!run) return { fares: '0', airports: 0, ago: '—', newToday: 0, status: 'never run' };
  return {
    fares: String(run.apiCalls ?? 0), airports: run.routesScanned ?? 0,
    ago: timeAgo(run.startedAt ? String(run.startedAt) : null),
    newToday: run.candidatesFound ?? 0, status: run.status ?? 'unknown',
  };
}
```

- [ ] **Step 8: Typecheck + commit**
```bash
cd web && npx tsc --noEmit && npm test && cd ..
git add web/src/lib web/vitest.config.ts web/package.json
git commit -m "feat(web): CandidateView model, pure helpers (tested), queries + mappers"
```

### Task 10: Deal queue page (grouped by template) + ported components

**Use the `yip-design-system` skill.** Port `Queue.jsx` (Queue, QueueRow, ScoreBadge, Topbar) and the stateful shell from `App.jsx` into a `QueueBoard` client component.

**Files:** `web/src/components/ScoreBadge.tsx`, `StatusPill.tsx`, `QueueRow.tsx`, `Queue.tsx`, `Topbar.tsx`, `QueueBoard.tsx`; page `web/src/app/(app)/queue/page.tsx`.

- [ ] **Step 1: Port presentational components** — from `ui_kits/curator/Queue.jsx`, converting JSX→TSX and typing props against `CandidateView`:
  - `ScoreBadge({ score }: { score: number })` — keep `.score` + `.hi/.mid/.lo` thresholds (≥80 hi, 60–79 mid, <60 lo).
  - `StatusPill({ status }: { status: DisplayStatus })` — keep `.stat` + `.stat.suggested/.review/.rejected/.published`; add `.expired` (reuse `.rejected` styling).
  - `QueueRow({ c, onOpen }: { c: CandidateView; onOpen: (id: number) => void })` — keep `.qrow` grid; thumbnail uses `style={{ background: c.grad }}`.
  - `Queue({ candidates, onOpen })` — keep `.queue` + `.qhead`.
  - `Topbar({ tab, setTab, scan }: { tab: string; setTab: (t: string) => void; scan: ScanView })` — keep the scan-status banner; bind to real `ScanView`.

- [ ] **Step 2: `QueueBoard.tsx`** ('use client') — replaces `App.jsx` state (tab filter + selected → opens Composer):
```tsx
'use client';
import { useState } from 'react';
import type { CandidateView, ScanView, TemplateGroup } from '@/lib/types';
import { Topbar } from './Topbar';
import { Queue } from './Queue';
import { Composer } from './Composer';

const TAB_TO_STATUS: Record<string, string | null> = {
  All: null, Suggested: 'suggested', 'In review': 'review', Published: 'published', Rejected: 'rejected',
};

export function QueueBoard({ groups, scan }: { groups: TemplateGroup[]; scan: ScanView }) {
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState<CandidateView | null>(null);
  const want = TAB_TO_STATUS[tab];
  const flat = groups.flatMap((g) => g.items);
  const byId = (id: number) => flat.find((c) => c.matchId === id) ?? null;
  return (
    <>
      <Topbar tab={tab} setTab={setTab} scan={scan} />
      {groups.map((g) => {
        const items = want ? g.items.filter((c) => c.status === want) : g.items;
        if (!items.length) return null;
        return (
          <section key={g.templateId}>
            <h3 className="sec-tmpl" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{g.templateLabel}</h3>
            <Queue candidates={items} onOpen={(id) => setSelected(byId(id))} />
          </section>
        );
      })}
      {selected && <Composer c={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
```

- [ ] **Step 3: Queue page** (server component) `web/src/app/(app)/queue/page.tsx`:
```tsx
import { getQueueRows, getLatestScanRun } from '@/lib/queries';
import { groupByTemplate, toScanView } from '@/lib/mappers';
import { QueueBoard } from '@/components/QueueBoard';

export default async function QueuePage() {
  const [rows, run] = await Promise.all([getQueueRows(), getLatestScanRun()]);
  return <QueueBoard groups={groupByTemplate(rows)} scan={toScanView(run)} />;
}
```
(`Composer` is created in Task 12; until then, stub it as a no-op client component so this compiles, then flesh it out.)

- [ ] **Step 4: Verify against real data**

`cd web && npm run dev`, sign in, open `/queue`: confirm template-grouped sections, rows showing real routes/prices/drops/scores/status pills, tab filtering works, scan banner reflects the latest `scan_runs` row. No console errors.

- [ ] **Step 5: Typecheck + lint + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/components web/src/app/\(app\)/queue
git commit -m "feat(web): deal queue grouped by template, wired to real candidates"
```

### Task 11: Today dashboard

**Files:** `web/src/app/(app)/page.tsx` (replace placeholder); optional `web/src/components/DashboardCards.tsx`.

- [ ] **Step 1: Implement the dashboard** — server component computing, from real queries: count of new high-score candidates (`score ≥ 80`, status `suggested`), candidates needing recheck (`verifiedAt` null or > 24h old), published deals expiring soon (`validUntil` within 7 days), and the latest scan-health summary. Render brand cards (display font for numbers — "numbers are the hero") + shortcut buttons: "Review top deals" → `/queue`, "Run scan" / "Recheck live deals" → server actions from Task 17 (wire the buttons to `enqueueScan`). Use `.card`, `.btn` classes.
```tsx
import Link from 'next/link';
import { getQueueRows, getLatestScanRun, getPublishedDeals } from '@/lib/queries';
import { toScanView, toCandidateView } from '@/lib/mappers';

export default async function Dashboard() {
  const [rows, run, published] = await Promise.all([getQueueRows(), getLatestScanRun(), getPublishedDeals()]);
  const views = rows.map(toCandidateView);
  const hot = views.filter((v) => v.status === 'suggested' && v.score >= 80).length;
  const needsRecheck = views.filter((v) => !v.verifiedAt).length;
  const scan = toScanView(run);
  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Today</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {/* card: hot deals (hot), needs recheck (needsRecheck), last scan (scan.ago / scan.fares) */}
      </div>
      <Link href="/queue" className="btn btn-primary">Review top deals</Link>
    </div>
  );
}
```
(Fill the cards using the brand card pattern from the design system; keep numbers in `--font-display`.)

- [ ] **Step 2: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/\(app\)/page.tsx web/src/components
git commit -m "feat(web): Today dashboard wired to real candidate/scan data"
```

### Task 12: Candidate review room (Composer, read-first)

**Use the `yip-design-system` skill.** Port `Composer.jsx` (drawer: hero, trip facts, signals, flags, copy drafter). Read-only first; write actions land in Milestone D.

**Files:** `web/src/components/Composer.tsx`, `CopyDrafter.tsx`; deep-link page `web/src/app/(app)/candidates/[id]/page.tsx`.

- [ ] **Step 1: Port `Composer`** — `Composer({ c, onClose }: { c: CandidateView; onClose: () => void })`. Keep `.scrim`, `.drawer`, `.dh` (hero uses `style={{ background: c.grad }}`), `.drow` trip-fact pills (from→to in `--font-mono`, dates, legs, airline, price + drop%), `.sec` signals (check icon, sea) and flags (alert-triangle, amber), and the Escape-to-close `useEffect`. Render `<CopyDrafter c={c} />`. The publish bar buttons (Reject / Schedule / Approve & publish) are wired in Milestone D — render them disabled for now.

- [ ] **Step 2: Port `CopyDrafter`** — `CopyDrafter({ c }: { c: CandidateView })`, the 3-tab editor (headline / hook / newsletter) bound to `c.copy.*`. Keep `.drafter`, `.dtab`, `.draftbox`, `.charcount`. Local `useState` for edits; persistence lands in Task 14.

- [ ] **Step 3: Deep-link detail page** `web/src/app/(app)/candidates/[id]/page.tsx` — server component that loads one match by id (`getCandidateRow`) and renders the Composer inline (no scrim) as a full review room, so a candidate is shareable/linkable:
```tsx
import { notFound } from 'next/navigation';
import { getCandidateRow } from '@/lib/queries';
import { toCandidateView } from '@/lib/mappers';
import { Composer } from '@/components/Composer';

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getCandidateRow(Number(id.replace(/^m/, '')));
  if (!row) notFound();
  return <Composer c={toCandidateView(row)} onClose={() => {}} inline />;
}
```
(Add an optional `inline?: boolean` prop to `Composer` that hides the scrim/close and renders in-flow.)

- [ ] **Step 4: Verify** — from `/queue`, click a row → drawer opens with real trip facts, signals from `reason_text`+derived, flags, and the draft copy. Escape closes. `/candidates/m<ID>` renders the same inline.

- [ ] **Step 5: Typecheck + lint + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/components/Composer.tsx web/src/components/CopyDrafter.tsx web/src/app/\(app\)/candidates
git commit -m "feat(web): candidate review room (Composer) wired to real data"
```

### Task 13: Scan health page

**Files:** `web/src/app/(app)/scans/page.tsx`.

- [ ] **Step 1: Implement** — server component listing recent `scan_runs` (extend `queries.ts` with `getRecentScanRuns(limit=20)` → `db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(20)`). Show per run: started/finished, duration, `apiCalls`, `http429s`, `candidatesFound`, `matchesCreated`, `errors`, `status`. Use mono metadata + a status pill (completed=sea, failed=coral). Also surface pending/running `scan_requests` (add `getPendingScanRequests()`), so the curator sees queued work.

- [ ] **Step 2: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/\(app\)/scans web/src/lib/queries.ts
git commit -m "feat(web): scan health page from scan_runs + scan_requests"
```

---

# Milestone D — Write actions (the core value)

Server Actions that mutate real rows. **Every action re-checks `await auth()`** (a matcher can skip the proxy on action POSTs).

### Task 14: Candidate status + content-draft save actions

**Files:** `web/src/app/actions.ts`; wire into `Composer`/`CopyDrafter`.

- [ ] **Step 1: Implement actions** `web/src/app/actions.ts`:
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { candidates, contentDrafts } from '@/db/generated/schema';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}

const ALLOWED = new Set(['new', 'seen', 'maybe', 'approved', 'edited', 'rejected', 'expired']);

export async function setCandidateStatus(candidateId: number, status: string) {
  await requireAdmin();
  if (!ALLOWED.has(status)) throw new Error(`invalid status ${status}`);
  await db.update(candidates).set({ status }).where(eq(candidates.id, candidateId));
  revalidatePath('/queue');
  revalidatePath(`/candidates/m${candidateId}`);
}

export async function saveContentDraft(input: {
  candidateId: number; templateId: number; headline: string; hook: string; news: string;
}) {
  await requireAdmin();
  const res = await db.update(contentDrafts)
    .set({ headline: input.headline, tiktokHook: input.hook, newsletterSnippet: input.news, status: 'edited' })
    .where(and(eq(contentDrafts.candidateId, input.candidateId), eq(contentDrafts.dealTemplateId, input.templateId)))
    .returning({ id: contentDrafts.id });
  if (res.length === 0) {
    await db.insert(contentDrafts).values({
      candidateId: input.candidateId, dealTemplateId: input.templateId,
      headline: input.headline, tiktokHook: input.hook, newsletterSnippet: input.news,
      status: 'edited', createdBy: 'curator',
    });
  }
  revalidatePath(`/candidates/m${input.candidateId}`);
}
```

- [ ] **Step 2: Wire `CopyDrafter`** — add a "Save copy" button calling `saveContentDraft` with the local edits (client component importing the server action). Show a saved toast (port the demo's `.toast`).

- [ ] **Step 3: Manual verify** — edit copy, save, reload → persisted. Set a candidate to `rejected` via a button → row leaves the "Suggested" tab.

- [ ] **Step 4: Commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/actions.ts web/src/components
git commit -m "feat(web): server actions — set candidate status + save content draft"
```

### Task 15: Publish action → `published_deals`

The core conversion: candidate → published deal, and mark the candidate decided.

**Files:** `web/src/app/actions.ts` (extend); wire the Composer publish bar.

- [ ] **Step 1: Implement `publishDeal`**:
```ts
import { dealTemplates, publishedDeals } from '@/db/generated/schema';

export async function publishDeal(input: {
  candidateId: number; templateId: number;
  headline: string; body?: string; tiktokHook?: string;
  channel?: 'public' | 'newsletter'; validUntil?: string | null;
}) {
  await requireAdmin();
  const [cand] = await db.select().from(candidates).where(eq(candidates.id, input.candidateId));
  if (!cand) throw new Error(`candidate ${input.candidateId} not found`);
  const [tmpl] = await db.select().from(dealTemplates).where(eq(dealTemplates.id, input.templateId));

  await db.insert(publishedDeals).values({
    candidateId: cand.id, dealTemplateId: input.templateId,
    publicLabel: tmpl?.publicLabel ?? null, newsletterTag: tmpl?.newsletterTag ?? null,
    headline: input.headline, body: input.body ?? null, tiktokHook: input.tiktokHook ?? null,
    origin: cand.origin, destination: cand.destination, zone: cand.zone,
    tripType: cand.tripType, travelDate: cand.travelDate, returnDate: cand.returnDate,
    price: cand.price, baselinePrice: cand.baselinePrice, discountPct: cand.discountPct,
    bookingUrl: (cand.itinerarySnapshot as any)?.booking_url ?? null,
    validUntil: input.validUntil ?? null, status: 'live',
  });
  await db.update(candidates).set({ status: 'approved' }).where(eq(candidates.id, cand.id));
  revalidatePath('/queue');
  revalidatePath('/published');
}
```
(Confirm `publishedDeals` column identifiers against the generated schema; the SQL columns are listed in `skrendam/db/models.py` `PublishedDeal`.)

- [ ] **Step 2: Wire the Composer publish bar** — "Approve & publish" calls `publishDeal` with the current (possibly edited) headline/hook; on success close the drawer + toast "'{place}, {country}' is live". "Reject" calls `setCandidateStatus(id, 'rejected')`. Buttons in a client component; disable while pending (`useTransition`).

- [ ] **Step 3: Manual verify the full loop** — open a suggested candidate → edit headline → Approve & publish → candidate disappears from Suggested, appears as published; a `published_deals` row exists (verify in DB).

- [ ] **Step 4: Commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/actions.ts web/src/components
git commit -m "feat(web): publish candidate -> published_deals + mark approved"
```

### Task 16: Published deals management

**Files:** `web/src/app/(app)/published/page.tsx`; actions `expireDeal`, `republishDeal`.

- [ ] **Step 1: Page** — server component listing `published_deals` (via `getPublishedDeals`), tabbed by `status` (live/draft/expired). Each row: route, price, drop, dates, `validUntil`, public_label; actions: Expire (`status='expired'`), Republish (`status='live'`), and copy-to-clipboard for `tiktok_hook` / newsletter text. Render with the boarding-pass styling for live deals.

- [ ] **Step 2: Actions** in `actions.ts`:
```ts
export async function expireDeal(id: number) {
  await requireAdmin();
  await db.update(publishedDeals).set({ status: 'expired' }).where(eq(publishedDeals.id, id));
  revalidatePath('/published');
}
export async function republishDeal(id: number) {
  await requireAdmin();
  await db.update(publishedDeals).set({ status: 'live' }).where(eq(publishedDeals.id, id));
  revalidatePath('/published');
}
```

- [ ] **Step 3: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/\(app\)/published web/src/app/actions.ts
git commit -m "feat(web): published deals management (expire/republish/copy)"
```

### Task 17: Recheck / Run-scan via the `scan_requests` queue

Closes the cross-process loop: admin enqueues; the Python worker (Milestone A) executes.

**Files:** `web/src/app/actions.ts` (extend); wire dashboard + Composer buttons; extend `queries.ts`.

- [ ] **Step 1: Enqueue actions**:
```ts
import { scanRequests } from '@/db/generated/schema';

export async function enqueueRecheck(candidateId: number) {
  await requireAdmin();
  await db.insert(scanRequests).values({ kind: 'recheck', candidateId, status: 'queued', requestedBy: 'curator' });
  revalidatePath(`/candidates/m${candidateId}`);
  revalidatePath('/scans');
}
export async function enqueueScan() {
  await requireAdmin();
  await db.insert(scanRequests).values({ kind: 'full_scan', status: 'queued', requestedBy: 'curator' });
  revalidatePath('/scans');
}
```

- [ ] **Step 2: Wire buttons** — Composer "Recheck" → `enqueueRecheck(c.candidateId)`; dashboard "Run scan" → `enqueueScan()`. Show the latest `scan_requests` status for the candidate (extend `queries.ts` with `getLatestRequestForCandidate(id)`); display "Recheck queued / running / done (€X) / error".

- [ ] **Step 3: End-to-end queue verify** — in one terminal run the worker against the dev DB:
```bash
SKRENDAM_DATABASE_URL='<neon direct url>' uv run skrendam worker
```
Click "Recheck" in the UI → within the poll interval the `scan_requests` row goes `queued → running → done`, a `verification_checks` row appears, and `candidates.verified_at` updates. Confirm in the UI + DB. Stop the worker.

- [ ] **Step 4: Commit**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
git add web/src/app/actions.ts web/src/components web/src/lib/queries.ts web/src/app/\(app\)
git commit -m "feat(web): recheck/run-scan via scan_requests queue (cross-process)"
```

---

# Milestone E — QA gauntlet (the full gauntlet, per the handoff)

Run in this order; fix between stages. This mirrors the Plan 1 QA pass.

### Task 18: Types + lint green (web + engine)

- [ ] **Step 1: Web typecheck + lint**
```bash
cd web && npx tsc --noEmit && npm run lint && cd ..
```
Expected: zero type errors, zero lint errors. The most likely failures are Drizzle identifier mismatches against `db/generated/schema.ts` — fix by matching the exact generated export/column names.

- [ ] **Step 2: Engine still green + typed**
```bash
uv run pytest -q
uv run mypy skrendam
```
Expected: all pass; mypy clean.

- [ ] **Step 3: Commit any fixes**
```bash
git add -A && git commit -m "fix: typecheck + lint clean across web and engine"
```

### Task 19: Playwright connected end-to-end journey

The flow the out-of-scope register deferred from Plan 1: **login → real candidate → approve → `published_deals`**. Requires a seeded Neon **dev** DB and a known test admin credential.

**Files:** `web/playwright.config.ts`, `web/e2e/journey.spec.ts`.

- [ ] **Step 1: Install Playwright**
```bash
cd web && npm i -D @playwright/test && npx playwright install chromium && cd ..
```

- [ ] **Step 2: `web/playwright.config.ts`**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```
Set a known E2E credential: in `web/.env.local` keep `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` and add the matching plaintext as `E2E_ADMIN_PASSWORD` (used only by the test).

- [ ] **Step 3: `web/e2e/journey.spec.ts`**
```ts
import { test, expect } from '@playwright/test';

const USER = process.env.ADMIN_USERNAME ?? 'admin';
const PASS = process.env.E2E_ADMIN_PASSWORD!;

test('curator logs in, reviews a real candidate, and publishes it', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);                 // auth gate

  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await page.click('button[type=submit]');

  await page.goto('/queue');
  const firstRow = page.locator('.qrow').first();
  await expect(firstRow).toBeVisible();                    // real data rendered
  await firstRow.click();
  await expect(page.locator('.drawer')).toBeVisible();     // review room

  await page.getByRole('button', { name: /approve & publish/i }).click();

  await page.goto('/published');
  await expect(page.locator('.qrow, .deal-card').first()).toBeVisible();  // it landed
});
```

- [ ] **Step 4: Run it**
```bash
cd web && npx playwright test && cd ..
```
Expected: the journey passes against the seeded dev DB. (If the publish button is disabled because no candidate is in `suggested`, re-seed or pick a suggested row.)

- [ ] **Step 5: Commit**
```bash
git add web/playwright.config.ts web/e2e
git commit -m "test(web): Playwright connected journey login->review->publish"
```

### Task 20: Code review, security review, and out-of-scope register

- [ ] **Step 1: `/code-review high`** on the branch diff. Process feedback with **`superpowers:receiving-code-review`** (invoke it *before* implementing fixes — verify each item, don't blindly apply). Re-run until clean.

- [ ] **Step 2: `security-review`.** Focus areas for this app: Auth.js secret + `AUTH_TRUST_HOST` handling, that **every Server Action re-checks `auth()`**, no secrets committed (`.env.local` is gitignored; `.env.example` has empty values), SQL-injection surface (Drizzle parameterizes — confirm no raw string interpolation), and that the proxy matcher actually gates every authed route.

- [ ] **Step 3: Update `docs/superpowers/out-of-scope.md`** — append what Plan 2 deliberately deferred:
  - **Config CRUD editors** (deal_templates, audience_segments, travel_moments, routes, zones) — Spec §10 views; deferred to **Plan 2 milestone 2** (locked scope decision). Until then, edit config by running the engine seeds / direct DB.
  - **AI suggestions/drafts placeholder** (Spec §10) — deferred.
  - **Recheck/run-scan E2E** — covered manually (Task 17 Step 3) because automated E2E would hit live `fli`; revisit with a fake backend toggle.
  - Mark item §1 ("Browser end-to-end journey") **resolved for the publish loop** (Task 19); recheck loop remains manual.

- [ ] **Step 4: Final full verification (evidence, per `superpowers:verification-before-completion`)**
```bash
uv run pytest -q && uv run mypy skrendam
cd web && npx tsc --noEmit && npm run lint && npm test && npx playwright test && cd ..
```
Paste the passing output into the PR description.

- [ ] **Step 5: Commit + finish the branch** — use **`superpowers:finishing-a-development-branch`** to open the PR (`feat/curator-admin` → `main`) with the verification evidence. Do not self-merge without review.
```bash
git add -A && git commit -m "docs: update out-of-scope register after Plan 2 core loop"
```

---

## Self-review (run against the spec — completed by the plan author)

**1. Spec §10 coverage:**

| §10 view | Task | Status |
|---|---|---|
| Today dashboard | 11 | ✅ |
| Deal queue grouped by template | 10 | ✅ |
| Candidate review room | 12 | ✅ |
| Publish deal panel | 15 | ✅ |
| Published deals | 16 | ✅ |
| Scan health | 13 | ✅ |
| Key statuses (lifecycle) | 9 (`status.ts`) | ✅ |
| Permissions (single admin) | 7 | ✅ |
| Recheck / run scan | 1–3 + 17 | ✅ (cross-process queue) |
| Deal templates editor | — | ⏸️ **Deferred** (milestone 2 — locked scope) → out-of-scope.md |
| Audience segments / Travel moments / Routes-zones editors | — | ⏸️ **Deferred** (milestone 2) → out-of-scope.md |
| AI suggestions placeholder | — | ⏸️ **Deferred** → out-of-scope.md |

The deferrals are intentional per locked decision #3 (core loop first) and are explicitly registered in Task 20 Step 3 — not silent gaps.

**2. Placeholder scan:** Logic/data/query/action code is given in full. Presentational components are written as **port-from-kit instructions** that name the exact source file (`ui_kits/curator/*.jsx`), keep the existing `curator.css` class names, and specify the typed props + real-data bindings — deliberate (the 510-line kit already exists; transcribing it verbatim would be noise). The `yip-design-system` skill is mandated at each UI task. No "TODO/handle errors/similar-to" placeholders remain.

**3. Type consistency:** `CandidateView` field names are identical across `types.ts` → `mappers.ts` → components. Action signatures are consistent where wired: `setCandidateStatus(candidateId, status)`, `saveContentDraft({candidateId,templateId,headline,hook,news})`, `publishDeal({candidateId,templateId,headline,...})`, `enqueueRecheck(candidateId)`, `enqueueScan()`. **One required verification point** (flagged in Task 6 Step 3 and Tasks 15/17): the Drizzle identifiers in `queries.ts`/`actions.ts` must match whatever `drizzle-kit pull` emits in `db/generated/schema.ts` — the executor confirms exact names right after introspection.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-plan2-curator-admin.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session with checkpoints. REQUIRED SUB-SKILL: `superpowers:executing-plans`.
