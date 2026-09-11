# Handoff — 2026-09-11: WP9 live-deal verification — code-complete, first run is the daily scan

**Branch:** `feat/wp9-deal-verification` (worktree `.claude/worktrees/wp9-verify`, base 89f6497).
**Plan:** `docs/plans/2026-09-11-wp9-live-deal-verification-plan.md` (6 tasks). **Spec:**
`docs/plans/2026-09-11-live-deal-verification-spec.md` (§4 amended 2026-09-11: the verification
gate is discovery's own price-anomaly predicate, not a stricter AND).
**Canonical context updated:** `docs/PROJECT.md` §3 "Live-deal verification", §4 lifecycle, §7.
**Research:** `.superpowers/sdd/2026-09-11-wp9-research.md`.

The problem it solves: a published deal died only by calendar or by hand, so a fare that moved
(€93 → €124) kept being advertised at the old price. On the morning of 2026-09-11 all three live
deals were 33–99 % above their published price. Now the daily scan re-checks every published deal
itself and the site says so honestly.

## What shipped

| Piece | Where | Notes |
|---|---|---|
| Migration `0015_deal_verification` | `alembic/versions/0015_deal_verification.py`, `skrendam/db/models.py` | `published_deals.current_price / current_price_at / window_min_price / window_min_date / verified_at` (nullable), `missed_checks` (NOT NULL, default 0); new `deal_price_checks` (deal_id FK CASCADE, checked_at, source, available, price, window_min_*, run_id). **Applied to Neon dev**; drizzle schemas re-pulled in `site/` and `web/` (c308fd2). |
| `verify_deal` + `transition` (pure) | `skrendam/verification.py` | One flights call on the candidate's exact itinerary (flight numbers from `itinerary_snapshot.legs`, order-sensitive, airline code ignored); the day's cheapest fare becomes `window_min_*`. `transition()` is pure and tested per rule (`tests/skrendam/test_deal_transition.py`). |
| Shared price gate | `skrendam/scanning/scoring/eligibility.py` `price_anomaly_ok` | Discovery (`weighted.py` gate 1) and verification use the same predicate — parity-tested on a 2,496-combo grid and 1.1 M combos in review. |
| Orchestrator step | `skrendam/scanning/orchestrator.py` `_verify_live_deals` | After the route pass and sweeps; health verdict computed **before** the step; `run_healthy = not aborted and not degraded`; cap counted as `adapter.api_calls` deltas (a date pair discovery already fetched is a cache hit and costs nothing); the exact loop stops on the first 429 or when the run's circuit breaker opens (`deals_verify_aborted`); the free calendar path applies to economy candidates only (`price_log` has no cabin column). Summary + health JSON: `deals_verified / deals_changed / deals_expired / verify_calls / deals_verify_aborted`. |
| Site | `site/src/lib/statuses.ts`, `queries.ts`, `mappers.ts`, `types.ts`, `lt.ts`, `Poster.tsx`, `deal/[id]/page.tsx`, `uzsisakiau/[dealId]` | `changed` deals render `current_price` with two lines „Dabar nuo €124" / „radome už €93"; `drop` recomputed against the shown price (0 without a baseline — no invented discount); freshness label reads `published_deals.verified_at` first; reader button „Kaina pasikeitė" → `deal_events.kind='price_changed'` (one per subscriber per deal, anonymous allowed). |
| Desk + letters | `web/src/lib/statuses.ts`, `verification.ts`, `PublishedBoard.tsx`, `published/page.tsx`, `(app)/page.tsx`, `letters*.ts`, `email/render.ts`, `copy.ts`, `actions.ts` | Live board shows state / current vs published / window min / missed checks / last check / check count; Today shows one summary line instead of the stale block; digest + nurture cards render „nuo €current · radome už €published" on `changed`; instant mail unchanged. |

Tests at HEAD: `uv run pytest tests/skrendam -q` 321 passed / 2 skipped; `site/` vitest 233;
`web/` vitest 224 (+ the Task 6 tweak below). No scanner, no `tests/search`, no Google call was made
while building this — everything runs on `FakeBackend`.

## The constants (one place: `skrendam/verification.py`)

| Constant | Value | Meaning |
|---|---|---|
| `PRICE_DRIFT_TOLERANCE_PCT` | 10 | `live` while the real price ≤ published × 1.10; beyond it → `changed` (or `expired` if the gate fails). Judged in **both** directions for the calendar-drift trigger. |
| `MISSED_CHECKS_TO_EXPIRE` | 2 | consecutive empty answers on **healthy** runs before `expired` (reason `missing_2_days`). Any real price resets it. |
| `EXACT_CHECK_MAX_AGE_DAYS` | 3 | an exact flights check is due when the last real answer (`verified_at`) is older than this; NULL counts as stale. The desk's `RECHECK_AFTER_DAYS` (`web/src/lib/verification.ts`) is aligned to 3. |
| `VERIFY_CALLS_PER_DAY` | 20 | cap on network flights calls the step may spend per run. Today's healthy run sits at ~849 of the ~900 envelope, hence 20 not the spec's 30. |
| `LIVE_STATUSES` | `('live', 'changed')` | the visible set; `site/src/lib/statuses.ts` and `web/src/lib/statuses.ts` are byte-identical copies. |
| `FREE_WINDOW` (orchestrator) | 3 | the site's public window — top 3 live/changed by `published_at DESC, id DESC`, mirrored from `site/src/lib/scarcity.ts`. Public deals get an exact check every day. |
| `MAILED_WINDOW` (orchestrator) | 48 h | deals in `issues.deal_ids` sent within it are second in priority after public ones. |
| `GOING_FAST_RISE` | 0.05 | unchanged; only the desk's manual Recheck sets the badge. |

The gate itself (`eligibility.gates_for(template, zone)` → `price_anomaly_ok(price, baseline, gates)`):
discount vs the frozen `baseline_price` ≥ the template's `min_discount_pct` (else the 20 % strong-anomaly
floor) **OR** under the ceiling (`tpl.max_price_eur`, zone `threshold_price_eur` for one-way only)
**OR** under the template's psychological price. The abs-saving floor is a soft signal, never a gate.
A deal with no baseline can only pass on the two thresholds.

## What the first run after merge will do

- **To the deals that were live on 2026-09-11 (ids 2, 3, 4):** nothing — the founder expired them by
  hand that morning after the recheck showed +33–99 %. There is no one-off SQL for this; the step
  handles stale deals from now on.
- **To whatever is `live`/`changed` at 06:00:** each deal gets one `deal_price_checks` row (a free
  `calendar` row when discovery already fetched that exact date pair today, else one exact `flights`
  call within the cap of 20, public deals first). Expect `deals_verified` = the number of live deals
  (calendar hits are free, so this can exceed 20); exact checks `verify_calls` ≤ 20 (the cap), and
  `api_calls` up by ≤ 20 over the day's discovery figure. A 429 mid-step stops the loop at once:
  `deals_verify_aborted` > 0 in the health JSON and a `verification stopped: rate limited after N
  calls` line in the log; the skipped deals keep their state and are tried next morning.
- **A deal published from the desk today** is checked the next morning; `verified_at` is NULL until
  then, so the desk's Today shows it under Recheck only once it is older than 3 days (see below).
- **Degraded / aborted run:** `deals_verified = 0`, no writes, statuses untouched — the run summary
  says `WARNING: scan DEGRADED` as before. A VPN-gated morning cannot expire anything.
- **Watch for:** a deal whose candidate snapshot has no flight numbers (legacy or hand-inserted rows).
  `verify_deal` cannot identify its itinerary, so `price = None` and the first real answer flips it
  to `changed` only when the day's cheapest fare on those dates is above the 10 % tolerance;
  within tolerance the deal stays `live` (rule shipped in this branch, commit 483c9b7). Every
  scan-born candidate carries `fare.raw` with flight numbers, so the dev DB should be clean — but
  glance at `candidates.itinerary_snapshot->'legs'` for any deal you publish by hand.

## How to read the desk

**Live board (`/published`).** Every row carries a state pill (`live` / `changed` / `expired`),
then for verified deals: `now €X (+33 %) · 2h ago` (hover = `current_price_at`), `window min €X on
<date>`, `missed N checks` when > 0, and `last check <ago> / never checked` (hover = local time)
with the `deal_price_checks` count. The Live tab lists `LIVE_STATUSES` (so `changed` deals are in
it); Expire / Posted chips follow the same set; Republish is offered on the rest.
- A `changed` row is **still on the site at the current price** — decide: leave it (honest „Dabar nuo"),
  supersede it from a cheaper candidate (route-context chip; this carries the candidate's price into
  `current_price` and restarts the state at `live`), or expire it.
- `missed 1 checks` means yesterday's answer was empty on a healthy run; one more healthy empty
  expires it. An empty answer on a degraded run does not count.

**Today (`/`).** The old stale block is gone; one line reads „N changed · M expired since yesterday"
(`changed` = current state, `expired` = `expired_at` within 24 h) and links to `/published`. Recheck
rows remain for live/changed deals whose last real answer is older than `RECHECK_AFTER_DAYS = 3`
(falls back to `last_seen_at`, then `published_at`, for never-verified deals) with honest copy:
last real answer / never checked / N empty answers in a row. The sidebar badge next to Live =
`changed` deals + deals due a recheck, each counted once. The manual Recheck button still exists —
it is the only thing that sets „going fast" — and it no longer overwrites `candidates.price`. Since
the final fix wave a real answer from Recheck writes the same fields as the daily step through the
shared `record_check` (a `deal_price_checks` row with `source='manual'`, `current_price*`,
`window_min_*`, `verified_at`, and the `transition`), so a hand recheck clears its own Recheck row
and can move a deal to `changed` / `expired` exactly as the 06:00 step would; an empty answer still
only stamps `unverified_since`.

**Machine → scan health.** The health JSON carries `deals_verified`, `deals_changed`,
`deals_expired`, `verify_calls`, `deals_verify_aborted`; the CLI's end-of-run line prints the first
three counters next to
candidates / matches / errors.

## Site and letters

- A `changed` deal shows `current_price` as its price, the two lines „Dabar nuo €X" / „radome už €Y"
  in the poster price cell (homepage + deal page), and the discount recomputed against the shown
  price (0 → no percentage anywhere when the baseline is missing). Locked rows show the current price
  only. „Tikrinta prieš N …" now reads `published_deals.verified_at` (fallback `last_seen_at`).
- **Reader signal:** `/uzsisakiau/<dealId>` has a second button „Kaina pasikeitė" that records
  `deal_events.kind = 'price_changed'` (kind bound in code; one per subscriber per deal). The WP8
  stats pages count only `click` / `booked_claim`, so read these straight from `deal_events` — a
  burst of `price_changed` on a `live` deal means the fare moved between checks; hit Recheck.
- Letters: digest / nurture cards render „nuo €current · radome už €published" on `changed` deals and
  drop „įprastai" there (the published price is the reference now, not the baseline). Instant mail
  is the published price, fired once by `publishDeal` only — `streams.test.ts` pins that single call
  site, so a `changed` deal can never be re-sent as instant.

## Deferred (decided, not built)

1. **Evening beat for public deals** (spec §6, ≤ 3 calls) — a later switch; one beat per day at
   06:00 for now.
2. **Sample-itinerary re-fetch** when the exact itinerary is gone but the window min still qualifies
   (spec §4 d) — the deal becomes `changed` with `window_min_*` as the sample; the booking link and
   flights are not replaced. Copy says „nuo €X", not a specific itinerary.
3. **`going_fast` from the daily step** — only the manual Recheck sets it (+5 %). Whether the daily
   step should drive the badge is unspecified; left alone.
4. **Supersede guard on `changed` deals** — `updateLiveDealFromCandidate` and `routeContext` compare
   against the *published* price, so a €100 candidate cannot supersede a deal published at €93 now at
   €124 (task-5 review). Decision pending: compare against `currentPrice ?? price` for `changed`.
5. **Median lifetime per archetype on `/letters/stats`** (spec §5 "Stats") — not in the plan's tasks;
   `expired_at − published_at` is already there for the nurture's „lasted" line.
6. **`S.verifiedAgo`** copy key — the label already exists in `site/src/lib/format.ts`; add the key
   only if the desk or letters need the string.
7. Curator-written `body` on a `changed` deal may still quote the found price — only the headline
   blurb is guarded (`priceFreeBlurb`). Edit by hand when superseding.

## Merge checklist

1. `gh run watch --exit-status` on the PR (never `pr checks --watch`).
2. After merge nothing needs seeding or SQL — 0015 is already on Neon dev.
3. Next morning: read the run summary line (`deals_verified/changed/expired`), open `/published`,
   confirm `deal_price_checks` rows exist for the live deals and `api_calls` rose by ≤ 20.
4. Never rescan after a completed healthy run; never probe `verify_deal` interactively.
