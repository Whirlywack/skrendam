# Domain Context

## Scoring

- **Scorer** — a named strategy implementing `score(ctx: ScoringContext) -> Score | None`. `None` means "this strategy does not flag this fare." Lives in `skrendam/scanning/scoring/`.
- **ScoringContext** — the immutable bundle a scorer may read: the `FareItinerary`, the window `Baseline`, the route's `PriceHistorySeries` (may be `None`), the `Zone`, the `DealTemplate`, and `previous_price`. New signals become new context fields, never new positional args.
- **Score** — a scorer's verdict: `scorer`, `value` (0–1), `score_0_100`, `quality_tier`, `reason_text`, `signals`.
- **PriceHistory** — read-module over `price_log` returning a route's `PriceHistorySeries` and derived stats (`min_seen`, `percentile`, `previous_price`). `DbPriceHistory` in prod, `InMemoryPriceHistory` in tests.
- **quality_tier** — `rare` (score_0_100 ≥ 94) | `great` (≥ 88) | `None`. Single source of truth: `skrendam/scanning/scoring/tiering.py`. Distinct from `published_deals.tier` (access tier: free/pro).
- **primary_scorer** — the `DealTemplate` field (default `weighted`) naming which scorer produces the headline `match_score`. If it doesn't fire, the headline falls back to the highest-scoring strategy that did.
