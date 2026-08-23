# Route expansion + scan cohorts — design (Pilot Workstream A)

> Spec date: 2026-06-12 · Branch: `feat/route-expansion` (off `main`)
> Status: approved design, pre-plan.
> Context: `docs/handoffs/2026-06-12-pilot-rework-handoff.md` (workstream A),
> `docs/research/2026-06-12-pilot-research.md` §5 Phase 0 (the why).

## Goal

Grow the scanned network from 14 routes to the full meaningful VNO/KUN/RIX network
(~120–150 routes) **without exceeding the observed Google-gating budget**, wake the
history-fed scorers (`drop`/`error_fare`/`rarity`) on the routes that feed content
fastest, and let the founder extend the network from the admin without code. This
workstream gates everything downstream: history accrues per-route, and three of four
scorers need ~8–10 points per route before they fire.

## Evidence this is built on (verified 2026-06-12, line-by-line + live DB)

- **Volume scales with specs = template×route combinations, not routes.** The loop is
  template-outer, route-inner (`orchestrator.py` ~L69). Jun 3 ground truth: 14 routes →
  40 specs → 270 api_calls. Calendar calls are cached per exact spec key;
  **`search_flights` (tier-2) has no cache** (`adapter.py`) — overlapping templates
  re-fetch the same cheap dates.
- **Budget:** ~40–60 calendar specs/run passed clean on Jun 3; Jun 11 got 33/40 gated
  90 minutes after a clean full scan — gating is heat/time-dependent, not volume-proven.
  Start inside the observed-safe envelope and tune from data.
- **Route loading:** `orchestrator.py` L64 loads all routes; `resolver.py` L61 filters
  `enabled` per template. There is no batching concept anywhere.
- **Drop scorer staleness hazard (cohorts create it):** `PriceHistorySeries.previous_price`
  (`history.py` L39) returns a bare price, no age. `drop.py` writes "since the last scan"
  into `reason_text`. Under tail rotation, "last scan" is ~10 days old — the queue would
  fill with misleading urgency the moment rotation starts.
- **Seeds safety property:** `seeds.py _get_or_create` never updates existing rows →
  founder-disabled routes are never re-enabled. Bulk-add must preserve this.
- **Worker seam:** `worker.py` L76 `full_scan` → `run_scan()` directly; the admin
  Scan-now button enqueues kind `full_scan` (`actions.ts` L197). One default change
  propagates everywhere.
- **One transaction per run:** a mid-run crash rolls back everything (observed
  2026-06-12: a 31-minute run lost to one transient Neon connection error). Cohorts
  shrink the blast radius; periodic commits stay out of scope.
- **Ops (2026-06-12):** launchd fires on schedule but macOS TCC denies launchd's bash
  access to `~/Documents` (`Operation not permitted`). Needs a one-time founder grant;
  not yet documented in `docs/ops/daily-scan.md` — ride-along below.

## Decisions locked during brainstorming (founder-confirmed)

| Fork | Decision |
|---|---|
| Cadence shape | **Tiered**: founder-picked core routes scan **every day**; the tail rotates. Core picked by **template coverage**, not volume: 3–4 VFR corridors (VNO/KUN→London, DUB, OSL; RIX→London), 3–4 proven cheap leisure (VNO–BCN, KUN–AGP, RIX–TFS class), 1–2 city-break staples — every enabled template must have ≥1 core route feeding it. |
| Mechanism | `routes.core BOOLEAN NOT NULL DEFAULT FALSE` (migration 0008) + **computed** tail slice: `route.id % rotation_days == today.toordinal() % rotation_days`. Rotation width is a tunable setting (`SKRENDAM_TAIL_ROTATION_DAYS`), **default 10** — budget math: ~140 tail/10 + ~10 core ≈ 24 routes ≈ 50–70 specs at 2–3× template overlap, top edge but inside the envelope (7 would start over it). Tighten toward 3 (research target ⅓/day) as gating data allows. Computed slice = retuning never rewrites route rows. Rejected: stored cohort ints (rebalance rewrites ~150 rows), resolver-param-only (nothing for admin to show or founder to control). |
| Day derivation | In the engine (`today.toordinal()`), not `daily-scan.sh` — the bash stays dumb. |
| CLI / worker default | `run_scan` scans **"due today"** (core + today's tail slice) by default; `--all-routes` is the explicit full-network escape hatch. Worker `full_scan` inherits due-today; admin button relabeled **"Scan today's cohort"**. |
| Degraded day | **Log only.** No requeue/retry: retrying into a gating window adds heat exactly when Google is hot; the tail slice self-heals next rotation. The run's health JSON gains a `plan` block (core count, tail count, planned specs) as the tuning instrument. Same stance for **width retunes**: changing `rotation_days` (e.g. 10→3) can leave a route unscanned for up to old-N days before its new slice comes up — harmless, self-healing, deliberately not "fixed". |
| Drop staleness | **No hard age cutoff** (a ≤2-day rule would blind `drop` on the entire tail — exactly the breadth tier). Instead: `previous_price_age_days` flows into `ScoringContext` and `Score.signals`, and `reason_text` states the age when the comparison is >1 day old ("down 30% from EUR210 seen 12 days ago"). Honest labeling, no invented decay math. |
| Marketability gate | Additive `deal_templates.min_departure_dates` (NULL = exempt). **Not** counted from decile-flagged dates (a 30-day September window flags ~3 — the gate would kill the template). Counted at persist time as calendar dates priced ≤110% of the **flagged calendar point** (not the tier-2 fare — calendar anchor is deterministic and conservative; adjudicated in review, locked by test) within the discovering spec's window; stored as `candidates.departure_date_count`; enforced in template matching. All eight templates assigned explicitly: planable — family-school-holiday-sun, september-sun, christmas-markets, plan-ahead-summer, vfr-watch — get 5; opportunistic — last-minute-weekends, last-warm-days ("one last sun trip" is an urgency angle, not a planning one), long-haul-opportunist — stay NULL. Since this touches all eight templates' gate values, `christmas-markets` also gains `min_discount_pct=25` (matching its peers) — it currently has no discount floor and no price ceiling, flagged "could flood in winter" in the 06-03 tuning analysis; founder can veto in PR review. |
| `departure_date_count` caveat | The count is window-relative to the *discovering* spec; when two templates with different windows match the same candidate, the stored count came from one of them. Acceptable v1 — column comment + model docstring say so, so nobody debugs it as a bug. |
| Seed home | `seeds.py ROUTES` extended in place (~120–150 tuples + core flags): one reviewable diff, already idempotent, never re-enables. **Founder reviews the route list, core picks, and zone coverage in the PR** — the list is the product's search space. |
| Zone coverage | The real VNO/KUN/RIX network includes destinations the six zones don't cover (TLV, DXB class). Add 1–2 new zones in the same seed (e.g. `MIDDLE_EAST`) with deliberately conservative thresholds + a PR note to run `calibrate` on them after a week of history — **never silently force them into LONG_HAUL**. Exclusions, if any, listed explicitly in the PR. |
| New templates | New audience `vfr` ("Visiting friends & family") + `vfr-watch` template (roundtrip, relative ~7–90 days, `included_destinations` enumerating the **actual IATA codes in the seed list** — STN/LTN/LGW/DUB/OSL etc., never "LON", **trip_len 3–14** — calendar scanned at 3, weekend-visit shape); `long-haul-opportunist` (LONG_HAUL zone, roundtrip, wide relative window, min_discount 30%, max_stops 2, gate-exempt, **trip_len 7–21**). `resolver.py` derives the RT calendar duration from `trip_len_min_days` alone — a NULL on a roundtrip template flows `duration=None` into the fli date search (mis-search or crash), so **a seed-validation test asserts every `trip_type="roundtrip"` template sets `trip_len_min_days`**, making the whole error class impossible. |
| Bulk add | Textarea paste of `origin,destination,zone[,core]` lines → parsed preview (new / already-exists / unknown-zone) → confirm insert. **Insert-only**: existing (origin, destination) pairs are never touched — preserves founder zone edits and the never-re-enable property. Behind `requireAdmin()`; parser is a pure, vitest-covered lib function; UI per the yip design system. |
| Flights cache | `FliAdapter.search_flights` gets the same in-process per-run cache as `search_calendar`, keyed `(origin, destination, travel_date, return_date, cabin)`. Cuts duplicate tier-2 fetches before cohort math even starts. |

## Non-goals (YAGNI)

- No drop-confidence decay function for stale comparisons — no data to calibrate one;
  revisit once rotation produces age-distribution data.
- No degraded-day requeue; no mid-run periodic commits (→ out-of-scope register).
- No TLL routes (founder decision #4). No per-route cadence editor beyond the core
  toggle. No hosted scheduler. No changes to scorer thresholds or tiering.

## Modules (build order)

1. **Engine cohort selection.** `Settings.tail_rotation_days` (default 10).
   `run_scan(..., all_routes: bool = False)`: filter the loaded routes to
   `enabled AND (core OR id % N == today.toordinal() % N)` before resolving; `resolve()`
   keeps receiving a plain route list. CLI grows `--all-routes`. `health_json` gains
   `plan: {core, tail, specs_planned}`.
2. **Migration 0008** (additive): `routes.core`, `deal_templates.min_departure_dates`,
   `candidates.departure_date_count` (with the window-relative comment). Apply to live
   Neon dev → `drizzle-kit pull` in **both** `web/` and `site/` → commit generated files
   → revision in PR body.
3. **Flights cache** in `adapter.py` (mirror the calendar-cache pattern).
4. **Drop staleness.** `PriceHistorySeries.previous_point()` returning the
   `HistoryPoint`; orchestrator derives `previous_price` + `previous_price_age_days`
   for `ScoringContext`; `drop.py` ages its `reason_text` and signals.
5. **Marketability gate.** Orchestrator counts ≤110%-of-fare dates per flagged point
   from the already-fetched calendar `points`; `_persist_fare` stores the count and
   skips templates whose `min_departure_dates` isn't met.
6. **Seeds.** New zone(s) with conservative thresholds; ~120–150 routes with zone +
   core assignments (researched from current VNO/KUN/RIX route maps at build time);
   `vfr` audience; the two new templates; gate values on the four planable templates.
7. **Admin.** Core toggle chip in `RouteForm`; bulk-add section on the routes config
   page (parser lib + preview + insert-only server action); Scan-now relabel.
8. **Ride-alongs.** `.python-version` pin (3.13 — fresh worktree venvs broke on 3.14);
   TCC troubleshooting section in `docs/ops/daily-scan.md`; out-of-scope register:
   add degraded-day requeue + periodic commits, and mark the 06-11 initiatives shipped.

## Testing (TDD, per module)

- Cohort selection: core scans daily; tail slice obeys `id % N` vs day; width change
  re-slices; `--all-routes` scans everything; disabled routes never scan; plan block
  lands in health JSON. (In-memory SQLite + fake backend, house style.)
- Flights cache: second identical tier-2 fetch hits cache (call count asserted);
  different date/cabin misses.
- Drop staleness: fresh comparison keeps current copy; 12-day-old comparison says
  "seen 12 days ago" and carries `previous_price_age_days`; no-history → no score.
- Gate: count computed from calendar points (≤110% of fare); template below its
  minimum produces no match; NULL-gate templates unaffected; count persisted.
- Seeds: idempotent re-run; founder-disabled route stays disabled; every enabled
  template has ≥1 core route (asserted as a test, not a hope); every roundtrip
  template sets `trip_len_min_days`.
- Bulk parser (vitest): valid lines, dupes-in-paste, unknown zone, case/whitespace,
  optional core column; action inserts only new pairs.
- Migration: `alembic check` no-diff (existing `test_migration.py` harness).

## QA gate

`scripts/pr-gate.sh` lane-aware during dev, `--full` before PR (lanes P+M+W) →
`/code-review high` → `superpowers:requesting-code-review` → PR per `docs/PR-GATE.md` §D
(spec/plan links, per-lane evidence, migration revision + live-apply + re-pull
confirmation). Founder review items called out in the PR body: the route list, core
picks, new-zone thresholds, exclusions. Anything cut → out-of-scope register.
