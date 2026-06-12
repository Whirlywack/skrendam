# Domain Context

## Scoring

- **Scorer** — a named strategy implementing `score(ctx: ScoringContext) -> Score | None`. `None` means "this strategy does not flag this fare." Lives in `skrendam/scanning/scoring/`.
- **ScoringContext** — the immutable bundle a scorer may read: the `FareItinerary`, the window `Baseline`, the route's `PriceHistorySeries` (may be `None`), the `Zone`, the `DealTemplate`, and `previous_price`. New signals become new context fields, never new positional args.
- **Score** — a scorer's verdict: `scorer`, `value` (0–1), `score_0_100`, `quality_tier`, `reason_text`, `signals`.
- **PriceHistory** — read-module over `price_log` returning a route's `PriceHistorySeries` and derived stats (`min_seen`, `percentile`, `previous_price`). `DbPriceHistory` in prod, `InMemoryPriceHistory` in tests.
- **quality_tier** — `rare` (score_0_100 ≥ 94) | `great` (≥ 88) | `None`. Single source of truth: `skrendam/scanning/scoring/tiering.py`. Distinct from `published_deals.tier` (access tier: free/pro).
- **primary_scorer** — the `DealTemplate` field (default `weighted`) naming which scorer produces the headline `match_score`. If it doesn't fire, the headline falls back to the highest-scoring strategy that did.

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

## Route scanning

- **cohort** — the set of routes due on a given day: all core routes plus today's tail slice. A
  cohort is what a single `run-scan` invocation fetches and scores.
- **core route** — a route flagged `routes.core`; included in every daily cohort regardless of
  rotation. Use for high-priority or always-on routes.
- **departure date count** — the number of calendar dates priced at or below 110 % of the flagged
  calendar point, measured within the discovering spec's window. Stored on the candidate; used by
  the marketability gate.
- **marketability gate** — per-template minimum on a candidate's `departure_date_count`, set in
  `deal_templates.min_departure_dates` (NULL = exempt). A candidate that clears the score
  threshold but fails this gate is blocked from the queue — the fare must be plannable before it
  is surfaced.
- **tail rotation** — the computed daily slice of non-core routes selected for scanning:
  `route.id % rotation_days == today.toordinal() % rotation_days`. Width is controlled by
  `SKRENDAM_TAIL_ROTATION_DAYS` (default 10), meaning each non-core route scans roughly once
  every ten days.
