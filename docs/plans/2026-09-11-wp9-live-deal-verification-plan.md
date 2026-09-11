# WP9 — Live-deal verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every published deal is verified automatically inside the daily scan; a deal whose price moved becomes `changed` (shown honestly with the current price), a deal that no longer clears its gate or is gone two days running becomes `expired`, with a price-check history the site, desk and letters can show.

**Architecture:** One additive migration (`0015`). A new `verify_deal` in `skrendam/verification.py` searches the deal's **exact itinerary** (flight numbers from the snapshot) and also records the day's cheapest fare on those dates; a pure `transition()` decides the state. The orchestrator runs the verification step after the route pass under a daily call cap and only when the run is not degraded. Site/desk/letters read a shared visible-status set (`live`, `changed`) and the new price fields.

**Tech Stack:** Python 3.13 (`skrendam/`), Next.js 16 (`site/`, `web/`), drizzle, vitest, pytest.

**Spec:** `docs/plans/2026-09-11-live-deal-verification-spec.md`. Verified facts (file:line; read before touching anything): `.superpowers/sdd/2026-09-11-wp9-research.md`.

## Global Constraints
- Branch `feat/wp9-deal-verification` from `main` (≥ 89f6497); worktree `.claude/worktrees/wp9-verify`.
- Alembic single head `0015_deal_verification` after `0014_email_streams`; parity gate on SQLite; generated drizzle files only via the controller's regen commit.
- **Never call Google Flights outside the daily scan.** Tests use `FakeBackend`. The verification step costs ≤ `VERIFY_CALLS_PER_DAY = 20` flights calls (today's healthy run is already at 849 of ~900), prioritised public → mailed in 48 h → newest; no forced calendar calls (research finding 2 — the spec's "Tier 0 free" is opportunistic only: if `price_log` for this run already has the deal's exact `(route, travel_date, return_date)` pair, record it as a `calendar` check at zero cost).
- **An empty answer never changes status** (BotGuard). Automatic expiry only on real prices, on two consecutive unavailable days with the run healthy, or by calendar. No verification step at all when the run is degraded (compute the health verdict before the step — research finding 5).
- `verify_deal` never writes `candidates.price` (the old `recheck_candidate` does; leave it for the manual desk button but stop it overwriting `candidates.price` — see Task 2).
- Deal gate = the template's effective gates (`eligibility.eff(tpl, zone, name)`: `min_discount_pct`, `min_abs_saving_eur`, `price_threshold_eur`) against the deal's frozen `baseline_price`; not the archetype floors.
- Constants in `skrendam/verification.py`: `PRICE_DRIFT_TOLERANCE_PCT = 10`, `MISSED_CHECKS_TO_EXPIRE = 2`, `EXACT_CHECK_MAX_AGE_DAYS = 3`, `VERIFY_CALLS_PER_DAY = 20`. Existing `GOING_FAST_RISE = 0.05` stays for the badge.
- Shared visible statuses: `LIVE_STATUSES = ('live', 'changed')` (Python) / `LIVE_STATUSES = ['live','changed'] as const` (site + web, byte-identical small module), replacing every literal `status = 'live'` read.
- LT copy honest: `changed` renders „Dabar nuo €124 · radome už €93"; never „skenuoti"; real numbers only.
- Trailers on every commit; Fable subagents; gates per app (`pytest tests/skrendam`, ruff; site/web tsc + vitest + eslint).

---

### Task 1: Migration `0015_deal_verification` + models
**Files:** `skrendam/db/models.py` (PublishedDeal additions; new `DealPriceCheck`), `alembic/versions/0015_deal_verification.py`, `tests/skrendam/test_migration.py`.
**Produces:**
```python
class PublishedDeal:  # additions, all nullable except missed_checks
    current_price: float | None; current_price_at: datetime | None
    window_min_price: float | None; window_min_date: date | None
    verified_at: datetime | None          # last REAL answer (moved here from candidates for deals)
    missed_checks: int = 0                # server_default "0"
class DealPriceCheck(Base):
    __tablename__ = "deal_price_checks"
    id; deal_id FK published_deals.id (index, ondelete CASCADE); checked_at DateTime; source str  # 'flights'|'calendar'|'manual'
    available bool; price float | None; window_min_price float | None; window_min_date date | None; run_id FK scan_runs.id nullable
```
- [ ] Failing test pinned at `0014_email_streams`: upgrade → columns exist, `missed_checks` defaults 0 on a pre-existing row; `alembic check` clean. Implement (batch_alter_table; create_table; indexes `ix_deal_price_checks_deal_id`). Commit `feat(db): 0015 deal verification — current price, checks history, missed_checks`.
- [ ] Controller: apply to Neon dev, regen drizzle in site + web, commit.

### Task 2: `verify_deal` + `transition` (pure) + constants
**Files:** `skrendam/verification.py`, `tests/skrendam/test_verification_published.py` (extend), new `tests/skrendam/test_deal_transition.py`.
**Produces:**
```python
@dataclass(frozen=True) class DealCheck: available: bool; price: float | None; window_min_price: float | None; window_min_date: date | None; source: str
def verify_deal(deal: PublishedDeal, adapter, *, now) -> DealCheck
#   one flights search for (origin, destination, travel_date, return_date, cabin); price = fare whose legs' flight numbers equal the snapshot's (exact itinerary) if present, else None+available=False? NO: exact missing but other fares present → available=True, price=None (itinerary gone), window_min = cheapest fare that day; no fares at all → available=False (empty answer)
def transition(deal, check: DealCheck, *, gates: Gates, today: date, run_healthy: bool) -> Decision  # Decision(status, missed_checks, expired_at, reason)
```
Rules (spec §4): empty answer → unchanged status, `missed_checks += 1` only if `run_healthy`, else unchanged; `missed_checks ≥ 2` → `expired` (reason `missing_2_days`); real price ≤ published × 1.10 → `live`, missed reset; real price above tolerance and still clears gates → `changed`; real price fails gates → `expired` (`gate_failed`); exact itinerary gone but window min clears gates → `changed` with `window_min_*` as the new sample (sample itinerary NOT re-fetched in this WP — note in copy „nuo €X"); calendar rule kept in the sweep. `gates` = `Gates(min_discount_pct, min_abs_saving_eur, threshold_eur)` built via `eligibility.eff`.
Also: stop `recheck_candidate` from overwriting `candidates.price` (write the observed price to `scan_requests.result_summary` only — it already does) — add a test that `candidates.price` is unchanged after a manual recheck.
- [ ] TDD each rule with fixtures; commit `feat(verify): verify_deal on the exact itinerary + pure deal state transitions`.

### Task 3: Orchestrator step
**Files:** `skrendam/scanning/orchestrator.py`, `tests/skrendam/test_orchestrator.py`, `tests/skrendam/test_e2e_pipeline.py` (constants re-derived honestly if they move).
- `_verify_live_deals(session, adapter, *, today, now, run_id, run_healthy, cap=VERIFY_CALLS_PER_DAY)`: select deals with status in `LIVE_STATUSES`; opportunistic `calendar` check from this run's `price_log` when the exact date pair exists (0 calls); then pick candidates for an exact check in priority order (public free-window ids — reuse the site rule: the top `FREE_WINDOW=3` live deals by the same ordering as `getFreeWindowIds` (read it and mirror in Python); deals in `issues.deal_ids` sent in the last 48 h; then newest) while `calls < cap`, skipping deals verified today already; write `deal_price_checks`, update deal fields, apply `transition`, stamp `expired_at`; count calls into `run.api_calls`.
- Ordering: compute the health verdict (`assess`) BEFORE the step, pass `run_healthy`; run the step after the route pass and the calendar sweep; the run summary reports `deals_verified`, `deals_changed`, `deals_expired`.
- [ ] Tests: with FakeBackend, a live deal at the published price stays live; +20% → changed; empty ×1 → unverified only; empty ×2 across two runs → expired; degraded run → no calls, no changes; cap respected (3 deals, cap 2 → 2 checks, public first). Commit `feat(scan): daily live-deal verification step under a call cap`.

### Task 4: Site
**Files:** `site/src/lib/statuses.ts` (new, `LIVE_STATUSES`), `queries.ts` (every literal `'live'` → `inArray(status, LIVE_STATUSES)`), `mappers.ts` + `types.ts` (`PublicDeal.currentPrice`, `foundPrice`, `state: 'live'|'changed'`, `verifiedAt` from `published_deals.verified_at` fallback candidate), deal card + deal page copy (`lt.ts`: `S.nowFrom = 'Dabar nuo'`, `S.foundAt = 'radome už'`, `S.verifiedAgo`), `sitemap.ts` (changed deals indexable like live), `uzsisakiau/[dealId]` page: second button „Kaina pasikeitė" → `deal_events.kind = 'price_changed'` (dedupe per subscriber like claims). Tests: mappers for changed/live, statuses used by queries (grep test: no literal `'live'` left in queries.ts).
- [ ] Commit `feat(site): changed deals with current price; verified-ago; price-changed report`.

### Task 5: Desk + letters
**Files:** `web/src/lib/statuses.ts` (byte-identical to site's), `web/src/components/PublishedBoard.tsx` + `published/page.tsx` (state, published vs current, window min, missed checks, last check, checks history count), `web/src/app/(app)/page.tsx` (stale block → „N changed / M expired since yesterday" from `deal_price_checks`/`expired_at`), `web/src/lib/letters.ts` + `letters-queries.ts` (picks use `LIVE_STATUSES`; digest/nurture pass `currentPrice`), `web/src/lib/email/render.ts` (`changed` card shows „nuo €current · radome už €published"; instant unchanged), `streams.ts` (never instant-send a `changed` deal — only `publishDeal` triggers it anyway; assert). Tests.
- [ ] Commit `feat(desk): verification state on Live/Today; letters render current prices`.

### Task 6: Docs + one-off
- PROJECT.md (§pipeline: verification step, states, cap, constants; the "never auto-expire on empty" rule), handoff note, `scripts/2026-09-11_expire_stale_live_deals.sql` is NOT needed (the first run handles it) — instead note that the first verification run will expire today's three stale deals if their real prices fail the gates or mark them `changed`.
- [ ] Commit `docs: WP9 live-deal verification`.

## Acceptance
Next scan after merge: `deals_verified` > 0 in the run summary; the three current live deals end up `changed` or `expired` with `deal_price_checks` rows; site shows „Dabar nuo …" on a changed deal; api_calls rises by ≤ 20.
