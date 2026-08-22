# Handoff — 2026-08-22: redesign shipped, Wave-1 scoring live, PR #8 armed

_One of the densest days on record. Everything below is merged to `main` and CI-green
unless marked otherwise. Companion docs are linked inline._

## START HERE tomorrow morning (2026-08-23)

1. **Open the lid; the 06:00 scan runs on wake if it was asleep.** Wait for the desktop
   notification (verified working).
2. This scan is **two readings at once**: (a) n=2 for the BotGuard cold-pace trend
   (n=1 was healthy: 2/47 gated), and (b) the **first scan on Wave-1 scoring** —
   expect FEWER but HONESTER candidates than yesterday's 227 (month-local baselines
   kill the ~24% "cheap month" inflation), an `outlier` scorer in candidate_scores,
   and possibly "possible error fare - verify fast" reasons.
3. **If HEALTHY → merge PR #8** (founder instruction, 2026-08-22 evening):
   `gh pr merge 8 --merge`, then the runbook:
   - `UPDATE routes SET core = true WHERE ...` for the 14 pre-existing dev rows that
     Phase A promoted (seeds are insert-only; the exact core set is in
     `skrendam/seeds.py` — every row commented `# core:`), simplest form:
     sync `routes.core` to the seed by origin+destination.
   - `uv run skrendam seed` (adds the 145 new routes, vfr audience, 2 moments,
     2 templates).
   - Verify: 159 routes, 29 core, 10 templates in dev DB.
   - The **08-24 06:00 scan is the first full-network run (~3x volume)** — read its
     health verdict remembering BotGuard punishes burstiness; if degraded, tune
     rotation pacing before panicking.
4. **If DEGRADED → hold the PR #8 merge**, reassess supply first.

## What shipped today (all merged, main green)

- **Deal Desk redesign** (PR #11 + follow-ups): Today/Review/Live/Machine IA, true
  distinct-candidate numbers, TZ fix, departure-city sub-pages, deal-type strip,
  sorting, top-3 group previews, date-clone collapse, TikTok/IG posted chips
  (migration 0009), boarding-pass rows with why+catch. Plan + 24-hole audit:
  `docs/plans/2026-08-22-deal-desk-redesign.md`.
- **Deal-detection research cycle**: two research runs (web + Consensus) →
  synthesis + Wave-0 diagnostics (quantization confirmed; dispersion spans 14x;
  January bug measured at 24%) → **Wave 1** (PR #12): month-local baselines
  everywhere, volatility-aware `outlier` scorer with error-fare fast path,
  was-price suppression <30%, queue clone collapse.
  `docs/research/2026-08-22-deal-detection-synthesis.md`.
- **Code review (medium)**: 7 confirmed findings fixed same day (PR #13) — outlier
  template-cap + error-label gates, degraded banner restored on Today, stale-live
  rule keys on lastSeenAt, React cache() query dedupe. One accepted-as-is: bulk
  dismiss includes beyond-preview rows (confirm shows full count). Review's final
  consolidation never landed (3 minor verdicts outstanding: 06:00 TZ label,
  cluster EUR25 bucket, thin-month reason — the last is fixed anyway).
- **Phase A route scoring** (`docs/research/2026-08-22-route-scoring-phaseA.md`):
  159 routes ranked on persona coverage x LT search demand x competition x
  dispersion; founder approved the core-30 (GVA flips core ~Dec 1; TRN promoted
  early as the ski feeder).
- **PR #8 updated and CI-GREEN, awaiting the post-scan merge**: merged with main,
  Phase A applied, alembic heads joined (0010), e2e counts re-derived
  (129 specs / 903 rows / 90 candidates, decomposed in-file).

## Standing queue after the merge

1. Workstream B (digest email) — sender-home decision still open.
2. Winter-sun threshold revisit ~Dec 1 (real winter history); GVA core flip ~Dec 1.
3. R0: funnel still has zero real humans; TikTok chips + hooks are live in the desk.
4. Wave 2 product rules (badge framing split, method-transparency line) +
   Wave 3 as data accrues (days-since-drop needs 14 consecutive scan days —
   counting from 08-21; zone cold-start priors before more route batches).
5. TLL-as-origin: research done (route-refresh doc §6), seeding deferred.

## Traps (learned the hard way today)

- `gh pr checks --watch && gh pr merge` merges on RED — use
  `gh run watch <id> --exit-status`, and verify with `gh run list` (the watch can
  misreport on races).
- npm 11 writes web lockfiles that CI's npm 10 (`node 22` actions) rejects —
  regenerate with `npx npm@10 install --package-lock-only`.
- Heredoc-appended Python tests skip ruff format — run `ruff format` before every
  commit (cost two red CI runs today).
- `test_cli` runs the REAL token bucket unless `SKRENDAM_MIN_CALL_INTERVAL_SECONDS=0`
  (was silently 9.5 min).
