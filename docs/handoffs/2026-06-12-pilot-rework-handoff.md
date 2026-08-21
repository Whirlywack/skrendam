# Handoff — Skrendam **Pilot Rework** (route expansion, digest, LT-first, evidence, pre-sale)

_Date: 2026-06-12. Audience: a fresh coding agent picking up the 90-day-pilot build.
Produced after 4 parallel code reviews (engine, web admin, public site, docs/process)
plus founder decisions recorded in `docs/research/2026-06-12-pilot-research.md` §7A._

## TL;DR

The engine (scan → 4-scorer scoring → curate → publish), curator admin (`web/`, :3000)
and public site (`site/`, :3001) are **built, merged, and healthy** — including the
June-11 fli-resilience and multi-strategy-scoring initiatives (both shipped; ignore any
"in brainstorm" status in older registers). Your job is the **pilot rework**, and the
founder has sharpened the mission to one sentence: **a working system where the deal
engine gives real value, approved deals flow into a beautiful, tracked email campaign,
and nothing else competes with that.** (TikTok content = the founder screenshotting
deals/emails — no content tooling needed beyond what the email already renders.)

Build order (re-scoped 2026-06-12, supersedes the five-equal-workstreams framing):

- **(A) Deal value** — route expansion + scan cohorts + new templates + marketability
  gate + flights-cache. Unchanged, still first: everything downstream eats its output.
- **(B) The campaign pipeline — the centerpiece.** Approved/published deals → digest
  composer → **beautiful LT-first email** (yip-design-system ticket card; **the
  evidence line "€89 — usually €210, cheapest 8% of 12 months" is part of THIS
  template**, absorbed from old workstream D) → Resend send → per-deal open/click
  tracking → scorecard queries. Includes rate limiting, unsubscribe/GDPR, forward-CTA,
  booking instructions. The email must look good enough to screenshot for TikTok —
  that IS the content strategy.
- **(C) Site LT localization** — now follows B (email copy is localized inside B;
  the site can lag the email without blocking the funnel).
- **(D, reduced) "book by ~X" half-life** — later enrichment of B's template once
  history depth supports it honestly.
- **(E) Founding-member pre-sale page** — unchanged, gated on funnel metrics.
- **(F) — dropped as a workstream.** The founder screenshots deals/emails; a per-deal
  share image (1080×1920 render of the ticket card) is an optional later add-on to B.

Each workstream = its own worktree → spec → plan → TDD → pr-gate → PR, per
`docs/PR-GATE.md`.

## Founder decisions (locked — do not re-litigate)

1. **LT-first language** on site + emails; English kept as parallel.
2. **TikTok cadence 1/day** — AI drafts from published deals, founder approves.
3. **Founding-member pre-sale**: €29/yr price-for-life, first 200, plain Stripe
   payment link — **no billing system build**.
4. **Scope: VNO/KUN/RIX deep (~120–150 routes), no TLL** in the pilot.
5. Monetization is subscription-led; affiliates supplementary. Mistake fares stay a
   later premium feature. fli stays the data source for this private phase (R1 stance
   unchanged).

## Repo & branch state

- Repo: `/Users/superoptimised/Documents/Skrendam` (fork of `punitarani/fli`; origin
  = github.com/Whirlywack/skrendam). `main` is green; latest merge = PR #7
  (fli-resilience).
- Three apps share one Neon Postgres; **no internal API** — the Next.js apps enqueue
  engine work via `scan_requests` and the engine never serves HTTP.
- Daily scan: launchd 06:00 Europe/Vilnius (`docs/ops/daily-scan.md`). Never run
  `skrendam-scheduler` (legacy double-scan risk).

## How we work (read this before touching anything)

**1. Git worktrees, not in-place branches.** The primary checkout
(`/Users/superoptimised/Documents/Skrendam`) **stays on `main` at all times**. Every
workstream gets its own worktree under `.claude/worktrees/<branch-name>`:

```bash
git worktree add .claude/worktrees/<branch> -b <branch> main   # start
# ... all coding happens inside the worktree ...
git worktree remove .claude/worktrees/<branch>                 # after merge
```

Verified state today: two stale worktrees exist (`deal-logic-v2`,
`feat+fli-resilience`), both merged and prunable — `git worktree prune` is safe
housekeeping. One worktree per workstream (A–F below); don't share a worktree across
workstreams.

**Worktree caveats (verified):**
- `scripts/pr-gate.sh` works from inside a worktree (it resolves its own root via
  `git rev-parse --show-toplevel` and diffs against merge-base with `main`).
- Machine-level installs do NOT: `scripts/install-daily-scan.sh` must run from the
  **primary checkout** (the launchd plist hardcodes the repo path).
- `web/.env.local` lives in the primary checkout and is gitignored — worktrees don't
  inherit it. Copy it (or export `SKRENDAM_DATABASE_URL`/`DATABASE_URL`) into the
  worktree if your work needs DB access, and never commit it.
- Each worktree needs its own `npm install` in `web/`/`site/` and gets its own
  `.next/` — cold-build inside the worktree you're shipping from.

**2. The verification script is `scripts/pr-gate.sh`** — lane-aware (runs only the
lanes your diff touches: P Python / M migration / MCP / J fli-js / W web / S site):

```bash
scripts/pr-gate.sh                 # mechanical lanes (tests, typecheck, lint, migration no-diff)
scripts/pr-gate.sh --full          # + cold Next builds + Playwright (run before every PR)
scripts/pr-gate.sh --base=<ref>    # stacked branch: diff against <ref> instead of main
```

Its green is **necessary, not sufficient** — every PR also needs the two review
passes and the PR-body evidence per `docs/PR-GATE.md` §C–D.

**3. The full loop per workstream:** worktree off `main` → spec
(`docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`) → plan
(`docs/superpowers/plans/YYYY-MM-DD-<name>.md`) →
`superpowers:subagent-driven-development` (TDD, task-by-task) → `scripts/pr-gate.sh
--full` → `/code-review high` → `superpowers:requesting-code-review` (process feedback
via `superpowers:receiving-code-review`) → PR (body per PR-GATE §D: spec/plan links,
per-lane evidence, migration revision + live-apply + Drizzle re-pull confirmation) →
merge → remove worktree. `main` always stays green.

## Read these first (source of truth — do NOT duplicate)

- `docs/PR-GATE.md` — the verification ritual; lanes P/M/MCP/J/W/S.
- `CONTEXT.md` — domain vocabulary (Scorer, quality_tier, unverified_since…). Update
  it if you introduce new vocabulary (e.g., "cohort", "digest issue").
- `docs/research/2026-06-12-pilot-research.md` — the why behind every workstream
  (market, competitors, funnel math, 90-day plan).
- `docs/ops/pilot-runbook.md` — the strategy↔build traceability table (§1) and the
  founder-side execution plan. **If a requested change doesn't trace to a line in
  that table, it's out of pilot scope — push back or route it to out-of-scope.md.**
- `docs/research/2026-06-12-deal-profiles-discovery.md` — engine/profile state map.
- `.claude/skills/yip-design-system/SKILL.md` — **mandatory for all UI/email/copy
  work** (tokens, fonts incl. Lithuanian diacritics, ticket component, voice).
- `docs/superpowers/out-of-scope.md` — deferred items; note §8 (email rate-limiting)
  becomes IN scope the moment real sending ships (Workstream B).
- Schema: `skrendam/db/models.py` (Alembic-owned); current head migration 0007.

## What the code reviews established (facts you'll need)

**Engine (`skrendam/`):**
- Scan flow: `cli.py:57 run_scan` → `orchestrator.py:89` loads **all enabled routes**
  (no batching concept anywhere) → `resolver.py:64` yields SearchSpecs per template →
  fli_adapter (pacing `~1.5–2s/call`, `config.py:12`) → baseline → all four scorers →
  `repositories.py` upserts. ~150 routes ≈ ≥5 min tier-1 alone; tier-2 scales with
  anomaly count. Circuit breaker: 5 consecutive failures aborts (status `failed`);
  gating verdicts via `fli_adapter/health.py` (status `degraded`).
- Cohort insertion points (pick in spec): (a) pre-filter `routes` in
  `orchestrator.py:89–91` by a new `Route` column (e.g. `scan_cohort` int) +
  `run_scan --cohort N` arg; (b) resolver filter param. The launchd job
  (`scripts/daily-scan.sh`) would derive cohort from day-of-week.
- Content drafts: `content.py:8 build_content_draft()` fills `headline`,
  `tiktok_hook`, `newsletter_snippet` from template strings (no LLM anywhere —
  CopyDrafter in admin is textareas + `saveContentDraft()` only). Engine never
  overwrites curator edits (`ensure_content_draft` returns existing).
- `subscribers` table (models.py:291): email unique, `source`, `confirmed` +
  `confirm_token` + `confirmed_at` (double opt-in), `early_alerts` bool, `prefs` JSON
  (already stores `{origins[], moments[]}` from the site prefs flow).
- `scan_requests`: kinds `full_scan`/`recheck`, polled by `worker.py` every 15s, up to
  5/batch, FIFO. Sharp edge: no row locking — **single worker only**; crashed worker
  leaves rows stuck `running`.
- Tests: in-memory SQLite via `tests/skrendam/conftest.py`, fakes for the fli backend,
  idempotency-asserting style. Migrations: additive-only, `NNNN_slug.py`, verified by
  `test_migration.py` (alembic check).

**Admin (`web/`):**
- Server actions: `actions.ts` (`publishDeal` writes headline/tiktokHook/publicLabel/
  newsletterTag/tier='free'/status='live'; `enqueueScan`, `enqueueRecheck`),
  `config-actions.ts` (upserts per config table; all behind `requireAdmin()`).
- `RouteForm.tsx` is **one-route-at-a-time**; no bulk import. Workstream A needs a
  bulk add (CSV/textarea paste of `origin,destination,zone` triples) or a seed script.
- Conventions: Drizzle schema is introspected (`drizzle-kit pull`) — **never edit
  generated files; re-pull after every migration in BOTH web/ and site/ and commit**.
  Vitest in `src/lib/*.test.ts`; tiers.ts GREAT=88 must stay synced with engine
  tiering.py (read, don't re-encode).

**Site (`site/`):**
- Pages all ISR `revalidate=300`. Queries in `lib/queries.ts`; known wart: missing
  composite UK on `candidate_template_matches` → client-side dedup (comment in file).
- Email capture is **done and solid**: `subscribe-action.ts` (validation, double
  opt-in via Resend when `RESEND_API_KEY` set, dev fallback single opt-in, httpOnly
  `yip_pt` cookie, prefs + early-alerts upsell, `source` attribution strings
  'home'/'subscribe'/'collection'/'deal'/'past'/'early').
- **Localization surface**: zero i18n today; `lang="en"` in `layout.tsx`; ~21
  components + 6 pages with hardcoded copy (~40–50 strings) + 2 email templates in
  `lib/email.ts`. Fonts already support LT diacritics (design-system requirement).
- **Evidence groundwork exists**: `lib/priceContext.ts` computes 90-day percentile
  from `price_log`; deal page already renders "Cheapest Xth percentile we've seen in
  90 days" + sparkline (low/median/high). Missing: "usually €X" phrasing on cards and
  any "book by ~X" signal.
- E2E: Playwright specs in `site/e2e/`; unit tests in `src/lib/`.

## The five workstreams

### A — Route expansion + scan cohorts (engine + admin; first, it gates everything)
History accrues per-route and three of four scorers need ~8–10 daily points, so this
ships first. Deliverables:
1. Destination list: build the full meaningful VNO/KUN/RIX network (~120–150 routes,
   zones assigned). Source it from current airport/airline route maps at build time;
   founder reviews the seed list in the PR. Extend `seeds.py` or a one-off
   `scripts/seed_routes.py` (idempotent, like seeds.py).
2. Cohorts: additive `routes.scan_cohort` column (migration 0008) + `run_scan
   --cohort` + day-of-week derivation in `daily-scan.sh`. Target: each cohort fits
   the observed gating budget (~40–60 calendar searches/run was the June-11 scale;
   33/40 once gated — stay modest, tune from `scan_runs` health data).
3. Bulk route add in admin (textarea paste → preview → insert) so the founder can
   extend without code.
4. Two new seeds: VFR-watch template (LON/DUB/OSL corridors; `audience` addition) and
   long-haul-opportunist template. Marketability gate: add `min_departure_dates` (≥5)
   to templates where planable (exempt last-minute/error-fare).

### B — Weekly digest pipeline (the biggest missing piece)
Nothing sends newsletters today; only the confirm email exists. Decisions to make in
spec (see "Resolve EARLY"). Deliverables: digest composer (live `published_deals`,
respecting `tier`, `newsletter_tag`, subscriber `prefs.origins`), Yip-design-system
email template (LT-first per Workstream C), send via Resend, a `digest_issues` record
(what was sent to whom, when — needed for "premium got it first" later), **and the
rate-limiting from out-of-scope §8** (per-email/per-IP on subscribe + send caps) which
becomes mandatory the moment real sending ships. Unsubscribe link + GDPR footer are
non-negotiable. Additional pilot requirements (from `docs/ops/pilot-runbook.md` §1):
**open/click measurement** (Resend webhooks or stats API → persisted per digest issue,
feeding the founder's weekly scorecard), **booking instructions + exact bookable dates**
in each deal block (Going's deal-email anatomy; data is in the candidate snapshot), and
a **"forward this to a friend" CTA** with `?src=fwd` attribution (the v1 referral
mechanic — a full referral program is deliberately deferred).

### C — LT-first localization (site + emails)
LT primary, `/en` parallel. Suggested shape (validate in spec): centralized string
dict (or `next-intl`), route-group restructure `app/(lt)` + `app/(en)` with middleware
default → LT, `lang` fixes, both email templates localized. ~27 files touched. Keep
the design-system voice ("clued-in local friend"); copy is founder-reviewable in PR.
SEO: hreflang pairs, localized metadata, sitemap update. The founder writes/edits
final LT copy — generate drafts, flag for review.

### D — Evidence line + "book by ~X" (site + engine stat)
1. Evidence line on every deal card + email: "€89 — usually €210; cheapest 8% of the
   last 12 months" — extend `priceContext.ts` percentile (widen window from 90 days as
   history grows) and surface on `DealTicket`, not just detail page.
2. "Book by ~X": empirical fare half-life — for past sub-threshold fares on the
   route/zone, how long did they stay live? Compute engine-side at publish time
   (snapshot onto `published_deals`, additive column) so site/email render a static
   honest estimate; recompute on recheck. Phrase as "deals like this usually last
   ~N days", never a promise.

### E — Founding-member pre-sale page (site; ship last, behind engagement)
One page: founding-member offer (€29/yr price-for-life, first 200), Stripe **payment
link** (no SDK), counter, FAQ, and writes interest to `subscribers.prefs` for
attribution. Copy must include **30-day money-back guarantee** and **price-for-life**
framing (Thrifty Traveler retention/urgency pattern — see pilot research §4). Gate:
founder triggers when funnel metrics hit the bars in `docs/ops/pilot-runbook.md` §4
(open ≥40% AND ≥1,000 subs). No entitlements build — fulfillment is manual list
membership until Spec 3.

### F — TikTok script extension (small; ride along with B or D)
Extend `build_content_draft()` with a `tiktok_script` (hook/beats/CTA, LT) field +
matching textarea in CopyDrafter, so the founder's 1/day flow is: publish → copy
script → record. Additive column on `content_drafts` + `published_deals` if needed.
No LLM in-engine; drafts stay template-filled (the founder's agent/Claude does the
creative pass outside the pipeline for now — keep the seam, not the dependency).

## Resolve these EARLY (in each workstream's spec)

1. **Digest sender home (B):** (a) Python job (scheduler/launchd sibling, full DB
   access, but Python now sends email); (b) Next.js route/cron on the site (Resend
   client already there, but long-running sends on serverless); (c) extend
   `scan_requests` pattern with kind `send_digest` processed by `worker.py`. The
   06-02 handoff faced the same cross-process question and chose the request-table
   pattern — (c) is consistent, but decide explicitly.
2. **Cohort mechanism (A):** route column + CLI arg vs resolver param; and what
   happens when a cohort's day is degraded (skip? retry next day? log only?).
3. **i18n approach (C):** route groups + dict vs `next-intl`; URL scheme (`yip.lt`
   LT-root + `/en`?); how emails pick locale (subscriber pref column — additive
   migration?).
4. **Half-life computation (D):** engine-side snapshot vs site-side live computation;
   minimum history bar before showing the line at all (honesty > coverage).
5. **Stripe pre-sale (E):** payment-link product setup is founder-side (account,
   VAT/receipts) — flag what you need from him early, don't block on it.
6. **Worker stuck-row sweep:** if B lands on the worker (option c), add the stale
   `running` requeue sweep first (known sharp edge).

## QA gate before merging each workstream

Run in this order, fix between: `scripts/pr-gate.sh` (lane-aware; `--full` before PR)
→ `/code-review high` → `superpowers:requesting-code-review` →
`superpowers:receiving-code-review` when processing feedback. Lanes you'll hit:
P+M (workstream A), P+M+S (B, D), S (C, E), P+W (F). Migration rule: additive only,
apply to live Neon, `drizzle-kit pull` in **both** apps, commit generated files, note
revision in PR body. New site surfaces: httpOnly tokens, no prices in JSON-LD,
`requireAdmin()` on any new admin action. Anything cut → append to
`docs/superpowers/out-of-scope.md`.

## First-hand verification addendum (2026-06-12, after line-by-line read)

Every claim below was verified directly in source + the live Neon DB — treat these as
overriding anything contradictory above or in older notes.

**Operational state (live DB, 2026-06-12):** only 3 scan runs exist EVER (Jun 3 failed
+ completed 1,846 rows/158 candidates; Jun 11 degraded 293 rows/0 candidates). **The
launchd daily scan is not firing** — no runs Jun 4–10 or Jun 12. Deepest route history:
2 days. `drop`/`error_fare`/`rarity` are dormant until daily cadence resumes. 1 live
deal, 16 subscribers. **First action for the founder, before any rework: run
`scripts/install-daily-scan.sh` and verify tomorrow's log.** Also: the weekly
upstream-watch agent (docs/ops/upstream-watch.md says "create with /schedule") was
never actually created — no scheduled task exists.

**Scan-volume model (corrects the pacing math above):** the loop is **template-outer,
route-inner** (`orchestrator.py` ~L70: `for tpl in templates: for spec in resolve(...)`).
Volume scales with **specs = template×route combinations**, not routes.
`routes_scanned` in scan_runs counts specs. Calendar calls are cached per exact spec
key (origin, destination, trip_type, window_start, window_end, duration, cabin) —
different template windows on the same route = separate network calls.
**Tier-2 `search_flights` has NO cache**: two templates covering the same route+window
flag the same cheap dates and fetch the same flights twice (adapter.py — only
`search_calendar` caches). Jun 3 ground truth: 40 specs → 270 api_calls. For ~150
routes × overlapping templates expect 600+ calls ≈ multiple hours at 1.5–2s/call —
cohorting is mandatory, AND a flights-cache keyed (route, date, cabin) is a cheap,
high-value addition to Workstream A. Also: roundtrip calendar searches use
`trip_len_min_days` only (resolver.py L58) — RT templates scan one trip length.

**Health/exit semantics (verified):** degraded = any of: ≥50% calendar calls empty
(≥5 calls), ≥10 calls with 0 price rows, or price rows <10% of prior run's (prior
≥100 rows) — `health.py` constants. CLI exits 0 healthy / 2 degraded-or-failed;
`daily-scan.sh` exit 1 = setup failure (no DB URL).

**Latent details in the publish path (verified in `web/src/app/actions.ts`):**
- `publishDeal` accepts a `channel` param that is **never written** (no column) — dead
  input; the tiered-release work (premium_at/public_at) lands exactly here.
- `published_deals.content_draft_id` exists but `publishDeal` never sets it (drafts
  reach the deal only as copied text fields).
- `booking_url` is pulled from `candidate.itinerary_snapshot.booking_url`.
- `republishDeal` clears `unverified_since`. `going_fast` is set by rechecks when the
  refetched price rises ≥5% (`verification.py` GOING_FAST_RISE).

**Site facts (verified):**
- `priceContext.ts`: sparkline/percentile needs `MIN_SAMPLES=14` price points in a
  90-day window per (route, trip_type) — one healthy scan (~60 points/route window)
  already satisfies it. Percentile is window-relative over all logged prices.
- `site` queries filter only `status='live'` — **no `tier` filter**. Fine while
  everything is 'free'; premium gating MUST change `lib/queries.ts` or paid deals
  leak to the public site.
- `subscribe-action.ts` has **no rate limiting** (confirmed; out-of-scope §8) — required
  before Workstream B ships real sending. `onConflictDoUpdate` is guarded so confirmed
  rows can't be hijacked via re-signup.
- Engine defaults already localized for fli calls: `config.py` `language="lt"`,
  `country="LT"`, EUR.

**Curator-decision safety (verified `repositories.py`):** re-found candidates refresh
price/last_seen always, but baseline/discount/snapshot/expiry only when status is NOT
approved/edited/rejected — curator decisions are never resurrected; `ensure_content_draft`
never overwrites curator edits. Cohort/bulk-add work must preserve both properties.

**Worker (verified):** single-process by design — claim is not atomic (no FOR UPDATE
SKIP LOCKED), crash leaves rows stuck "running" with no auto-recovery (documented in
`worker.py` docstring). Poll 15s, batch 5, FIFO; one shared TokenBucket across the
batch, fresh adapter per request.

## Gotchas / housekeeping

- Python ≤3.13 via `uv`; engine tests: `uv run pytest -q --ignore=tests/search`.
- `.env` bcrypt hashes: escape `$` as `\$` (dotenv-expand).
- Ports: web :3000, site :3001. Cold-build before trusting "build clean" (stale `.next/`).
- Out-of-scope register marks the 06-11 work "in brainstorm" — it is **shipped**;
  update the register when you touch it.
- `RESEND_API_KEY` absent in dev → single opt-in fallback is by design.
- Seeds never re-enable founder-disabled routes (`_get_or_create` has no update) —
  keep that property in the bulk-add path.
- Don't promise prices/availability in generated copy; every number must come from
  the scan (engine principle: AI writes around verified numbers).
