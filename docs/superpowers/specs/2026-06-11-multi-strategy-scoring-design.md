# Multi-strategy, history-aware deal scoring — design

> Spec date: 2026-06-11 · Branch: `feat/multi-strategy-scoring` (stacked on `feat/site-cro-redesign`)
> Status: approved design, pre-plan.

## Goal

Make the Skrendam deal engine able to **score a fare in more than one way** and **hunt for deals it
currently cannot see**. Today all scoring lives in one function (`skrendam/scanning/matching.py:match`)
and the engine has no memory of prices it has already recorded (`price_log` is written every scan but
read nowhere). This design turns scoring into a swappable **Scorer** seam fed by a **ScoringContext**,
gives the engine a **PriceHistory** read-module over `price_log`, persists every scorer's verdict
additively, and computes tier meaning once at the source instead of re-deriving it across three codebases.

Two product outcomes:
1. New scoring strategies are *additions* (a new file), not edits to a shared function.
2. New deal-hunting features — price-drop, error-fare, rarity — become possible because the engine can
   finally read its own price history.

## Decisions locked during brainstorming

| Fork | Decision |
|---|---|
| Multi-score storage | **Additive side table** `candidate_scores`; keep `candidate_template_matches.match_score` as the headline. web/site keep working. |
| Queue ranking | **Primary-scorer per template**: each `DealTemplate` names its headline scorer (default `weighted`). |
| Tier-meaning leak | **Store tier engine-side**: engine writes `score_0_100` + `quality_tier`; apps read them. |
| Migrations | **Apply to live Neon too**, but additive/nullable only, after the suite is green, with the `DATABASE_URL` target confirmed first. |

Naming guard: `published_deals.tier` already exists and means **access tier** (`free`/`pro`). The quality
tier introduced here is a **separate** concept and uses the column name `quality_tier` everywhere — the two
must never be conflated.

## Non-goals (YAGNI)

- No per-scorer weights in the DB yet — new scorers keep their bars as in-module constants, movable to
  config later.
- No removal of `match_score` or `matching.match()` — both kept for back-compat.
- No change to the curator workflow, publish flow, worker queue, or fli adapter.
- No new UI surfaces; only the existing score/tier reads in web/site change.
- No reworking of `published_deals.tier` (access tier).

## Vocabulary (to be added to `CONTEXT.md`)

- **Scorer** — a named strategy implementing `score(ctx: ScoringContext) -> Score | None`. `None` means
  "this strategy does not flag this fare."
- **ScoringContext** — the immutable bundle a scorer may read: the `FareItinerary`, the window `Baseline`,
  the route's `PriceHistorySeries` (may be `None`), the `Zone`, the `DealTemplate`, and `previous_price`.
  New signals are added as new context fields, never as new positional args to `score`.
- **Score** — a scorer's verdict: `scorer` (name), `value` (0–1), `score_0_100` (int), `quality_tier`
  (`rare`/`great`/`None`), `reason_text`, `signals` (dict).
- **PriceHistory** — a read-module over `price_log` returning a route's `PriceHistorySeries` and derived
  stats (`min_seen`, `percentile(price)`, `previous_price`).
- **quality_tier** — `rare` | `great` | `None`, derived from `score_0_100`. Distinct from access tier.
- **Eligibility** — shared pure gate helpers (itinerary sanity, trip-type scope) a scorer may apply.

## Architecture

### Module 1 — Scorer seam: `skrendam/scanning/scoring/`

New subpackage. Files:

- `base.py` — the interface and the data it moves:
  ```python
  @dataclass(frozen=True)
  class Score:
      scorer: str
      value: float            # 0..1 native confidence
      score_0_100: int        # normalized for display + tiering
      quality_tier: str | None
      reason_text: str
      signals: dict

  @dataclass(frozen=True)
  class ScoringContext:
      fare: FareItinerary
      baseline: Baseline
      zone: "models.Zone"
      template: "models.DealTemplate"
      history: "PriceHistorySeries | None"
      previous_price: float | None

  class Scorer(Protocol):
      name: str
      def score(self, ctx: ScoringContext) -> Score | None: ...
  ```
- `tiering.py` — **single source of truth** for normalization + thresholds:
  `GREAT = 88`, `RARE = 94`; `to_score_100(value: float) -> int`; `quality_tier(score_100: int) -> str | None`.
  Every `Score` is built through these helpers so no other module re-encodes the thresholds.
- `eligibility.py` — pure gate helpers lifted from `matching.py`: `itinerary_ok(fare, tpl) -> bool`,
  `in_template_scope(tpl, route, point, today) -> bool` (re-homing `_fare_in_template_scope`).
- `weighted.py` — `WeightedScorer(name="weighted")`: today's exact behaviour — the price-anomaly gate,
  the itinerary-sanity gate, the 0.50/0.20/0.15/0.15 blend, `SEND_THRESHOLD = 0.55`, and the
  `STRONG_ANOMALY_DISCOUNT = 0.20` floor — returning a `Score` (with `signals` carrying the former
  `gate_results`). Logic moves here verbatim; constants move with it.
- `registry.py` — `REGISTRY: dict[str, Scorer]`; `enabled_scorers() -> list[Scorer]` (all registered, in a
  deterministic order); `get(name) -> Scorer | None`.

`matching.match()` is reduced to a shim that builds a minimal `ScoringContext` (no history) and delegates
to `WeightedScorer`, returning a legacy `MatchResult`, so `tests/skrendam/test_matching.py` passes
unchanged. The shim is the back-compat seam; the orchestrator stops calling it (Module 4).

### Module 2 — PriceHistory: `skrendam/scanning/history.py`

```python
@dataclass(frozen=True)
class PriceHistorySeries:
    route_id: int
    trip_type: str
    points: tuple[HistoryPoint, ...]   # (scanned_at, travel_date, price)
    def min_seen(self) -> float | None
    def percentile(self, price: float) -> float    # 0..1, fraction of history at/below price
    def previous_price(self, travel_date, before) -> float | None

class PriceHistory(Protocol):
    def for_route(self, route_id: int, trip_type: str) -> PriceHistorySeries: ...

class DbPriceHistory:          # prod adapter
    def __init__(self, session, window_days: int = 180): ...
class InMemoryPriceHistory:    # test adapter
    def __init__(self, series_by_route: dict): ...
```

- `DbPriceHistory` prefetches each route's recent series **once per scan** (one query per route, served
  from memory thereafter) — no N+1. Bounded by `window_days`.
- New composite index on `price_log`: `(route_id, trip_type, travel_date, scanned_at)`.
- Two adapters justify the seam: `DbPriceHistory` in prod, `InMemoryPriceHistory` in tests.
- `baseline.py` is untouched and stays **pure** — it still computes the window `Baseline` from the current
  scan's `CalendarPoint`s. History is a *separate* input carried on the context, not a baseline change.

### Module 3 — Per-scorer persistence (additive)

New table:
```python
class CandidateScore(Base):
    __tablename__ = "candidate_scores"
    id: int (pk)
    candidate_id: FK candidates.id (index)
    deal_template_id: FK deal_templates.id (index)
    scorer: str
    value: float
    score_0_100: int
    quality_tier: str | None
    reason_text: str | None
    signals: dict | None        # JSON
    created_at: datetime
    # logical uniqueness (candidate_id, deal_template_id, scorer) enforced via upsert-by-select
```

`candidate_template_matches` gains nullable headline columns: `score_0_100: int | None`,
`quality_tier: str | None`, `primary_scorer: str | None`. `match_score` stays (the headline scorer's 0–1
`value`) for back-compat.

`deal_templates` gains `primary_scorer: str` (default `"weighted"`, server_default `"weighted"`).

`published_deals` gains nullable `score_0_100: int | None` and `quality_tier: str | None`, snapshotted at
publish from the headline match (so the public site reads them directly without a join).

New repository helper `upsert_score(session, candidate_id, template_id, score: Score)` mirrors
`upsert_match`'s select-then-write. `upsert_match` keeps its signature but is called with the headline
score's fields.

### Module 4 — Orchestrator wiring: `skrendam/scanning/orchestrator.py`

`run_scan` constructs a `DbPriceHistory(session)` once. `_persist_fare` changes from "call `match()` per
template" to:

1. For each in-scope template (`trip_type` + `in_template_scope`):
   - Build a `ScoringContext` (window `baseline`, `history.for_route(...)`, `previous_price`, zone, template).
   - Run **every** enabled scorer: `scores = [s for sc in enabled_scorers() if (s := sc.score(ctx))]`.
   - If `scores` is empty, skip this template.
   - **Headline selection**: `primary = first score whose scorer == template.primary_scorer`, else the
     `max(scores, key=score_0_100)`. This guarantees an error-fare the weighted scorer missed still
     surfaces *and* has a rankable headline number.
   - Collect `(template, headline, scores)`.
2. A candidate is created if **any** template produced a headline (same orphan-prevention as today).
3. Persist: `upsert_candidate` (unchanged) → per template, `upsert_match(headline fields incl.
   score_0_100, quality_tier, primary_scorer)` + `upsert_score(...)` for each score + `ensure_content_draft`
   (unchanged).

`ScanRun` audit counters are unaffected except `matches_created` keeps meaning "headline matches created".

### Module 5 — New detectors

- `scoring/drop.py` — `PriceDropScorer(name="drop")`: uses `ctx.previous_price` (and recent series) to
  score an overnight/period fall; fires only past a conservative drop bar.
- `scoring/error_fare.py` — `ErrorFareScorer(name="error_fare")`: fires when `ctx.fare.price` is far below
  `ctx.history.min_seen()` (the implausibility band); deliberately lenient on itinerary because an error
  fare is worth surfacing even if ugly.
- `scoring/rarity.py` — `RarityScorer(name="rarity")`: scores `1 - history.percentile(price)` — how rarely
  this route is ever this cheap; fires past a rarity bar.

Each is pure, registered in `registry.py`, and tested against `InMemoryPriceHistory`. Bars are in-module
constants. Templates keep `primary_scorer="weighted"`, so the queue's headline ordering is unchanged; new
strategies surface additional candidates, clearly attributed via `candidate_scores.scorer`.

### Module 6 — Closing the tier-meaning leak downstream

Engine is now the source of `score_0_100` + `quality_tier`. Consumers stop re-deriving:

- **web/** (`src/lib/mappers.ts`, `tiers.ts`, `components/ScoreBadge.tsx`, dashboard `page.tsx`/
  `DashboardCards.tsx`): read `score_0_100` / `quality_tier` from the row instead of `Math.round(score*100)`
  and `tierForScore`; re-point the stray `80`/`60` badge and dashboard thresholds to one shared constant so
  they stop drifting from `88`. Re-pull the Drizzle schema (`npm run db:pull`).
- **site/** (`src/lib/quality.ts`, `mappers.ts`, `deal/[id]/page.tsx`): read `quality_tier`/`score_0_100`
  (from `published_deals`); drop the four `×100` scale guesses. Re-pull Drizzle.
- **skrendam/analyze.py**: count `quality_tier` values instead of recomputing from `0.88`; keep the
  sync-comment but point it at `scoring/tiering.py` as the now-single source.

`tiers.ts`/`quality.ts` retain a `GREAT_THRESHOLD` constant only as a display fallback for rows that predate
the backfill.

## Data flow (after)

```
calendar search → baseline (pure, window)
                → PriceHistory.for_route (memory, prefetched)
   per flagged date → detail search → min-price fare
       → ScoringContext{fare, baseline, history, zone, template, previous_price}
       → every Scorer.score(ctx) → [Score, …]
       → headline = primary_scorer's score or best
       → upsert_candidate / upsert_match(headline) / upsert_score(each) / draft
publish → snapshot score_0_100 + quality_tier onto published_deals
web/site/analyze → read score_0_100 + quality_tier (no re-derivation)
```

## Testing strategy (TDD)

Pure unit tests (no backend) for: `tiering` (normalization + thresholds), `WeightedScorer` (parity with the
old `match()` across the existing `test_matching.py` cases), `PriceDropScorer`, `ErrorFareScorer`,
`RarityScorer`, `PriceHistorySeries` stats, and `ScoringContext` assembly. `DbPriceHistory` gets a SQLite
test (seed `price_log`, assert series/min/percentile/previous). Orchestrator tests extend the existing
`FakeBackend` to assert: multiple `candidate_scores` rows persisted, headline selection picks the primary
scorer, and an **error-fare-only** fare (weighted scorer returns `None`) still creates a candidate.
Repository tests cover `upsert_score` idempotency and `upsert_match` headline fields. A migration test
asserts the schema builds. web/site get vitest cases for the new mapper reads. Existing pytest, vitest, and
Playwright suites must stay green.

## Migration (live Neon, additive only)

One Alembic revision after `adb4f0192c7e`:
- create `candidate_scores`;
- add nullable `score_0_100`, `quality_tier`, `primary_scorer` to `candidate_template_matches`;
- add `primary_scorer` (default `"weighted"`) to `deal_templates`;
- add nullable `score_0_100`, `quality_tier` to `published_deals`;
- add composite index `(route_id, trip_type, travel_date, scanned_at)` to `price_log`.

Optional cheap backfill: set `candidate_template_matches.score_0_100 = round(match_score*100)` and
`quality_tier` from `tiering` for existing rows. All operations additive/nullable — safe on live data.
Apply to live Neon **after** the suite is green and **after** confirming the `DATABASE_URL` target; then
`npm run db:pull` in web and site.

## Build sequence

1. `tiering` + `base` (`Score`/`ScoringContext`/`Scorer`) + `eligibility` + `WeightedScorer` parity +
   `registry`; `match()` becomes a shim. (Pure; no DB.)
2. `PriceHistory` (`InMemoryPriceHistory` + `DbPriceHistory`) + `price_log` index migration.
3. `candidate_scores` + headline columns + `deal_templates.primary_scorer` migration; `upsert_score`;
   orchestrator switches to the registry with headline selection.
4. New detectors (`drop`, `error_fare`, `rarity`) wired through the context.
5. Tier centralization downstream (web/site mappers + thresholds, `analyze.py`, Drizzle re-pull,
   `published_deals` snapshot at publish).
6. Apply the migration to live Neon; verify; re-pull Drizzle.

## Risks & mitigations

- **Queue flooding** by eager new scorers → conservative in-module bars; headline ordering still driven by
  `primary_scorer="weighted"`.
- **PriceHistory cost** on a large `price_log` → bounded `window_days` + one prefetch query per route + the
  new composite index.
- **Live migration** → additive/nullable only; gated behind a green suite and an explicit `DATABASE_URL`
  confirmation.
- **Drizzle drift** in web/site → re-pull after the migration; covered by the existing introspection flow.
- **Scale-conversion regressions** in web/site → vitest on the new mapper reads; keep the TS threshold
  constant as a fallback for un-backfilled rows.
