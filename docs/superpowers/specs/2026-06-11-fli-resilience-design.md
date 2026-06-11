# fli-dependency resilience — design

> Spec date: 2026-06-11 · Branch: `feat/fli-resilience` (off `main`)
> Status: approved design, pre-plan.

## Goal

Make the Skrendam deal engine able to **tell "quiet market" from "broken pipe"** — and make the one
place where bad data destroys state immune to the confusion.

`fli` is a reverse-engineered Google Flights client. When Google gates or changes its private API,
the response is an HTTP-200 error envelope; fli's defensive decoders turn it into `None`, the
adapter's `or []` turns that into an empty list, the circuit breaker records *success*, and the scan
finishes `status="completed"` with zero candidates and zero errors. Nothing anywhere can see the
difference between that and a slow market. Worse, a recheck that gets an empty list today sets
`available=False` and **expires the candidate's live published deals** — during a gated window, one
"recheck live" click takes down the public site's inventory because the pipe broke, not the fare.

This design records emptiness as evidence at the adapter seam, judges each run's health with a pure
verdict function, surfaces the verdict (DB status → admin banner → CLI exit code), stops empty
rechecks from expiring anything, and adds the date-based expiry that should have existed anyway.

## Evidence this is built on (verified 2026-06-11, this branch)

- **The gate is real and intermittent (heat-based), not a constant outage.** Probes on June 9–11 got
  blocked envelopes from both search RPCs; the same probes passed later on June 11. A full
  production-paced scan (275 calls) ran clean the same evening, while 4 live tests had failed with
  empty results under the test suite's sustained load minutes earlier. Any individual scan can be
  healthy, partially empty, or fully empty — and today they all look identical.
- **The silent path is exact**: `fli/search/_wire.py parse_first_wrb_payload` → `None` →
  `fli/search/dates.py` returns `None` → `skrendam/fli_adapter/live_backend.py` masks with `or []` →
  `skrendam/scanning/orchestrator.py` calls `breaker.record_success()` → `compute_baseline([])` →
  `None` → template silently skipped.
- **The recheck hazard is exact**: `skrendam/verification.py` — empty fares ⇒ `responded=True,
  available=False` ⇒ `_update_published_for_candidate` flips live deals to `expired`.
- **Healthy-run signature** (two independent runs: prod June 3, demo June 11): ~270 api_calls,
  ~1,850 price_log rows, 0 of ~40 calendar searches empty. The gated mode is ~all searches empty.
  The detection margin is wide.
- **Errors are counted, never described**: both healthy runs logged `errors=4` and no detail about
  what they were exists anywhere. Classification (`adapter._classify`) string-matches `str(exc)`.
- **`published_deals.valid_until` is enforced nowhere** (set at publish, displayed in admin, never
  read again). Production currently has 1 live deal and has never run a recheck.

## Decisions locked during brainstorming

| Fork | Decision |
|---|---|
| Scope | Resilience only: detect + fail-safe + classify + upstream-watch. **No HTML-fallback backend** in this initiative (separate future decision; RPC currently works at our pacing). |
| Where detection lives | **At the adapter seam** (per-call outcome capture) + a **pure verdict** at end of run. Not aggregate-only, not a canary probe (a cold canary passes while sustained load gets gated — observed live). |
| Empty recheck → live deal | **Never expire on empty alone.** Mark `unverified_since`; expiry comes only from dates or the curator. |
| Alert surface | `ScanRun.status="degraded"` + `health` JSON → Deal Desk banner → loud CLI warning + exit code 2. No new alerting infra. |
| Upstream fli updates | Keep vendored; add a **weekly scheduled watch agent** over `punitarani/fli`. No runtime code. |
| Breaker | Unchanged. Empties must NOT trip it — we want the whole-run picture, not an aborted run. |

## Non-goals (YAGNI)

- No HTML-fallback data path (the probes proved one exists; it is a separate initiative if needed).
- No scheduler/worker deployment (adjacent ops gap, noted for later; nothing here depends on it).
- No email/webhook alerting; the banner + exit code are the v1 surfaces.
- No automatic recovery, retry-on-empty, or re-scan logic.
- No per-route health history tables — the verdict + JSON metrics on `ScanRun` are enough for v1.
- No changes to candidate TTL expiry (time-based, already outage-immune).

## Vocabulary (to be added to `CONTEXT.md`)

- **CallRecord / CallLog** — one record per *network* call the adapter makes (cache hits excluded):
  `kind` (`calendar`/`flights`), `route`, `trip_type`, `outcome`, `rows`, and for errors the
  classified kind + truncated message. The `CallLog` lives on the adapter for one run.
- **outcome** — `data` (succeeded, non-empty), `empty` (succeeded, zero rows), `error` (raised).
  The whole design rests on distinguishing `empty` from `data` at the seam.
- **HealthVerdict** — the pure judgment over a `CallLog`: `status` (`healthy`/`degraded`),
  `reasons` (human-readable), `metrics` (counts persisted to `scan_runs.health`).
- **degraded** — a `ScanRun.status` value: the run finished and its data was committed, but its
  results should not be trusted as a picture of the market. `failed` (breaker) takes precedence.
- **unverified_since** — nullable timestamp on `published_deals`: the deal is live but the engine
  has been unable to confirm it since this time. Set by an empty recheck, cleared by a successful one.
- **expiry sweep** — end-of-run housekeeping that expires live published deals whose `valid_until`
  or travel date has passed. Pure calendar logic; works identically during an outage.

## Architecture

### Module 1 — `skrendam/fli_adapter/health.py` (new): CallLog + verdict

```python
@dataclass(frozen=True)
class CallRecord:
    kind: str                  # "calendar" | "flights"
    route: str                 # "VNO-BCN"
    trip_type: str
    outcome: str               # "data" | "empty" | "error"
    rows: int = 0
    error_kind: str | None = None   # ScanError subclass name
    error_msg: str | None = None    # truncated str(exc)

class CallLog:
    records: list[CallRecord]
    def record(...) -> None
    # derived counts: calendar_calls, calendar_empty, flights_calls, flights_empty, errors

@dataclass(frozen=True)
class HealthVerdict:
    status: str                # "healthy" | "degraded"
    reasons: list[str]
    metrics: dict              # JSON-ready

def assess(log: CallLog, price_rows: int, prior_price_rows: int | None) -> HealthVerdict
```

Bars are in-module constants (house style, like scorer bars):

- `EMPTY_RATIO_BAR = 0.5`, `MIN_CALENDAR_SAMPLE = 5` — degraded when ≥ half of ≥ 5 calendar calls
  came back empty.
- `NO_DATA_MIN_CALLS = 10` — degraded when ≥ 10 api calls produced exactly 0 price rows (the
  near-zero partial cases are the ratio bar's and cliff's job).
- `CLIFF_PRIOR_MIN_ROWS = 100`, `CLIFF_FRACTION = 0.10` — degraded reason when the previous
  *completed* run logged ≥ 100 price rows and this run logged < 10% of that. Secondary signal;
  only meaningful once scans have a cadence.
- `ERROR_DETAIL_CAP = 20` — at most this many error records go into the JSON.
- Detail-search (`flights`) emptiness is reported in `metrics` but never decides alone — a flagged
  date with no fares can be legitimate.

### Module 2 — adapter capture (`skrendam/fli_adapter/adapter.py`)

`FliAdapter` gains `self.call_log = CallLog()` next to `api_calls`. `search_calendar` /
`search_flights` record one outcome per network call: `data`/`empty` by result length, `error` with
the classified kind before re-raising. Cache hits record nothing. This is the only adapter behavior
change; signatures stay identical.

Same module, `_classify` switches to typed checks, keeping the string heuristics only as fallback
for non-fli exceptions:

```python
from fli.search.exceptions import (SearchConnectionError, SearchHTTPError, SearchTimeoutError)

def _classify(exc):
    if isinstance(exc, SearchHTTPError):
        return RateLimitedError(...) if exc.status_code == 429 else ScanError(...)
    if isinstance(exc, SearchTimeoutError):   return TimeoutError_(...)
    if isinstance(exc, SearchConnectionError): return ConnectionError_(...)
    ...existing string fallback...
```

`ParseError` (raised by `_to_itinerary`) is unchanged.

### Module 3 — orchestrator wiring (`skrendam/scanning/orchestrator.py`)

At end of `run_scan` (after `_expire_stale`):

1. Count this run's `price_log` rows; fetch the previous completed run's count.
2. `verdict = assess(adapter.call_log, price_rows, prior_rows)`.
3. Status mapping, explicit: `run.status = "failed"` if the breaker aborted, else `"degraded"` if
   `verdict.status == "degraded"`, else `"completed"`. Always set
   `run.health = {"reasons": ..., "metrics": ..., "errors": [...]}`.
4. Run the **expiry sweep**: live `published_deals` with `valid_until < today` OR `travel_date <
   today` (both columns live on `published_deals`, both nullable — a deal with neither date set is
   never date-expired and stays curator-managed) → `status="expired"`. Lives next to `_expire_stale`.
5. `ScanSummary` gains the verdict so CLI/worker can surface it.

A degraded run commits everything it got — status conveys trust, not validity.

### Module 4 — recheck fail-safe (`skrendam/verification.py`)

`_update_published_for_candidate` changes semantics:

- `available=False` (empty list): live deals are **left live**; each gets
  `unverified_since = unverified_since or now`. No expiry, no `last_seen_at` update.
- `available=True`: `unverified_since = None`, `last_seen_at = now`, `going_fast` as today.
- Exception path: unchanged (`responded=False`, nothing touched).

Consequence (accepted): **no recheck can ever expire a deal.** Expiry comes from the sweep
(Module 3) or the curator's existing manual expire button.

### Module 5 — surfacing

- **CLI** (`skrendam/cli.py`): print verdict + reasons after the summary line; exit 0 healthy,
  **2 degraded**, 1 remains "crashed".
- **Worker** (`skrendam/worker.py`): `full_scan` requests include `{"health": status, "reasons": [...]}`
  in `result_summary`.
- **Deal Desk** (`web/`): dashboard banner when the latest run is `degraded` or `failed`, listing
  reasons from the `health` column (the dashboard already fetches the latest `scan_runs` row);
  "unverified since …" chip on the Published board where `unverified_since` is set. Styling per the
  yip design system. Drizzle re-pull after the migration.
- **site/**: untouched (it never reads these columns in v1).

### Module 6 — upstream watch (ops, no runtime code)

`docs/ops/upstream-watch.md` documents a weekly scheduled cloud agent: clone/compare
`punitarani/fli` against the vendored base, report new commits touching `fli/search/`,
`fli/models/`, or decoder files; deliverable is the agent prompt + the `/schedule` routine created
at ship time. Keeps the fork patchable while making upstream fixes visible within a week.

## Data flow (after)

```
run_scan
  adapter.search_*() ──► CallLog.record(data | empty | error+kind)
  ...scan loop unchanged (breaker only sees raised errors)...
  end of run:
    assess(call_log, price_rows, prior_rows) ──► HealthVerdict
    ScanRun.status = completed | degraded | failed     ScanRun.health = {reasons, metrics, errors}
    expiry sweep: valid_until / travel date passed ──► published_deals.status = expired
CLI ──► verdict printed, exit 0/2          worker ──► result_summary.health
web dashboard ──► banner from latest run   web published board ──► unverified chip

recheck (worker)
  fares == []  ──► check recorded, deal stays live, unverified_since set
  fares != []  ──► verified: unverified_since cleared, last_seen_at, going_fast
```

## Schema & migration (0007, additive only)

- `scan_runs.health` — JSON, nullable.
- `published_deals.unverified_since` — DateTime, nullable.
- No DDL for status values (plain String column).
- Revision `0007_fli_resilience`, `down_revision = "0006_multi_strategy_scoring"`.
- Ritual as 0006: suite green → confirm `DATABASE_URL` target → apply to Neon (dev branch) →
  `npm run db:pull` in `web/` (site schema unaffected).

## Testing strategy (TDD)

Pure tests for `health.assess`: empty-ratio bar (over/under, min-sample gate), no-data floor,
cliff (with/without prior), healthy passthrough, error-detail capping. Adapter tests with a fake
backend: outcomes recorded for data/empty/error, cache hits not recorded, `_classify` maps fli's
typed exceptions (incl. 429 via `status_code`) with string fallback intact. Orchestrator tests
extend `FakeBackend`: all-empty backend ⇒ `status="degraded"` + populated `health` + zero
candidates; mixed case ⇒ degraded with partial data committed; healthy case stays `completed`;
sweep expires past-`valid_until` and past-travel-date deals and leaves future ones. Verification
tests: empty ⇒ no expiry + `unverified_since` set (idempotent on repeat); success ⇒ marker cleared;
exception path unchanged; **existing expiry-on-unavailable tests updated to the new rule**.
CLI exit-code test. Migration applies/downgrades on scratch SQLite. Vitest: web mapper reads
`health`/`unverified_since`; banner renders on degraded. Existing pytest/vitest/Playwright stay green.

## Build sequence

1. `health.py` (CallLog/CallRecord/HealthVerdict/assess) — pure, with tests.
2. Adapter capture + typed `_classify`.
3. Migration 0007 + models (`health`, `unverified_since`).
4. Orchestrator: verdict stamping + expiry sweep; `ScanSummary.health`.
5. Verification fail-safe rewrite.
6. CLI exit codes + worker `result_summary.health`.
7. Web: Drizzle pull, mapper, dashboard banner, unverified chip.
8. `CONTEXT.md` vocabulary + `docs/ops/upstream-watch.md`; create the `/schedule` routine.
9. Apply migration to Neon dev; verify; `npm run db:pull`.

## Risks & mitigations

- **False positives** (sparse-but-legit markets) → ratio bar + minimum sample; degraded never
  discards data; thresholds are constants in one module, tunable after observation.
- **Stale deals linger** (sold-out fare stays live until its date) → bounded by `valid_until` /
  travel date; `unverified_since` chip tells the curator; manual expire remains.
- **Threshold drift between bars and reality** → `analyze` can later report empty-ratios per run;
  out of scope v1.
- **Drizzle drift** → re-pull `web/` after migration (0006 ritual).
- **Worker recheck batches during an outage** → each empty recheck just stamps `unverified_since`;
  harmless, reversible, and visible.
