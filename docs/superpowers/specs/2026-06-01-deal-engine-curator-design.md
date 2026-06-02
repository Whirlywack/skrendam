# Spec 1 — Internal Deal Engine + Curator (Design)

- **Status:** Proposed — awaiting review (v2, profiles reframe)
- **Date:** 2026-06-01 · **Revised:** 2026-06-02
- **Project:** Skrendam (Lithuanian/Baltic flight deals; grow a travel-deal email audience)
- **Related:** [`docs/research/2026-06-01-deal-engine-v1-review-brief.md`](../../research/2026-06-01-deal-engine-v1-review-brief.md) (risk analysis, live validation, alternatives)

---

## 1. Summary

An **internal-only** deal-finding tool. A paced Python scanner reuses the `fli` library to search Google Flights along **profiles** — named, reusable search strategies for different occasions and traveler types (e.g. "Last-minute long weekends", "Summer sun", "Christmas city breaks", "Plan-ahead summer"). It scores fares into a ranked queue of **deal candidates, grouped by profile**, and a Next.js **curator admin** lets the founder approve / edit / reject them into `published_deals`.

**Only the founder ever uses this tool.** End users never touch search. The public side (a later, minimal spec) shows *only* the deals the curator selects, plus newsletter sign-up CTAs. The near-term business goal is simply to **grow an email list of travel-deal-interested leads**; monetization is a deferred later phase.

The engine is **live-validated** — `fli` was run against real Lithuanian routes (VNO→STN €17, VNO→BCN €30, KUN→AGP €57), warm calls ~1s, no 429s. See §2A of the review brief.

### Build order (revised)
1. **Spec 1 — Internal deal engine + curator (profiles)** ← *this doc*. Founder-only.
2. **Spec 2 — Minimal public site:** showcase of curated deals (grouped by profile) + **plain email capture** + newsletter CTAs. No accounts, no billing.
3. **Spec 3+ — Monetization (next phase):** segmented newsletters (reusing profile tags), paid tiers, affiliate. Deferred.

---

## 2. Goal & success criteria

Done when:
1. The scanner runs a daily pass across the **enabled profiles** without sustained HTTP 429s (tracked in `scan_runs`).
2. It produces a **ranked candidate queue, grouped by profile**, each with price-vs-baseline + a plain-language "why it triggered."
3. The curator can **triage to `published_deals` in a few minutes/day**, with deals tagged by profile.
4. `price_log` accumulates per-scan history (for smarter baselines later).
5. A full daily pass completes in a practical window (target **< ~30 min** on a warm worker).

Tunable signals, not hard SLAs.

---

## 3. Scope

**In scope:** Postgres schema + migrations; route/zone config; **profiles** (bundled search strategies) + their config; the `fli` adapter (pacing/backoff/timeout); profile-driven two-tier scanner; baseline + scoring/triage with per-profile thresholds; candidate persistence with lifecycle, dedup, and profile tagging; `scan_runs` ops metrics; a one-off calibration script; the **internal** Next.js curator admin (auth-gated, single user) with profile-grouped queue and approve/edit/reject → publish.

**Out of scope (later specs):** the public website + deals showcase + email capture (Spec 2); accounts, Stripe/billing, premium gating, segmented newsletter delivery, paid tiers, affiliate (Spec 3+); push/SMS alerts; mobile app; multi-language content.

**Hard rule:** this tool is **internal-only**. There is no end-user access to search, profiles, or the candidate queue. Externally, users will only ever see curator-selected `published_deals` and a newsletter CTA.

**Run on the side, no build:** audience-conversion testing (TikTok → email) is done manually by the founder.

---

## 4. Architecture

```
        ✈ Google Flights  (external, rate-limited)
                 ▲  our pacing (~1 call/1–2s + jitter) · backoff · circuit-breaker
                 │  (on top of fli's built-in 10/sec + 3 retries + FLI_TIMEOUT)
        ┌────────┴───────────────┐
        │  Python Scanner Worker  │  warm, long-lived service · off-Vercel
        │  (Railway/Fly/VPS)      │  Python ≤3.13 · imports the `fli` library
        │  APScheduler (daily)    │  iterates ENABLED PROFILES
        └────────┬───────────────┘
                 │ tier-1: SearchDates calendar (per profile window) → price_log
                 │ tier-2: SearchFlights (anomalies only) → scoring → candidates (tagged by profile)
                 ▼
        ┌────────────────────┐
        │      Postgres       │  Neon (Vercel Marketplace)
        │  zones · routes ·   │  Alembic = single source of truth for schema
        │  profiles ·         │
        │  scan_runs ·        │
        │  price_log ·        │
        │  candidates ·       │
        │  published_deals    │
        └────────┬───────────┘
                 │ reads candidate queue (by profile) · writes published_deals + candidate.status
                 ▼
        ┌────────────────────┐
        │  Curator Admin       │  Next.js (App Router) on Vercel · INTERNAL · auth-gated · single user
        └────────────────────┘
                 │
                 ▼  (Spec 2 reads published_deals → minimal public showcase + email capture)
```

Two loosely-coupled deployables (Python worker, internal Next.js admin) sharing only Postgres.

---

## 5. Components

### 5.1 Config store (`zones`, `routes`, `profiles`)
- **Purpose:** the editable definition of *where* we can fly (routes/zones) and *what to go looking for* (profiles).
- **Interface:** Postgres tables, CRUD via the curator admin.

### 5.2 `fli` adapter
- **Purpose:** the only code that touches `fli`. Wraps `SearchDates`/`SearchFlights`, applies our pacing/backoff/timeout, maps errors to typed `ScanError`. Includes a **within-run fetch cache** keyed by `(route, window)` so overlapping profiles don't re-request the same calendar.
- **Interface:** `search_calendar(origin, dest, window, *, currency, locale)`; `search_flights(origin, dest, date, *, filters)`.

### 5.3 Pacing / backoff layer
- Local token bucket (~1 call / 1–2s + jitter), exponential backoff on 429/timeout, circuit-breaker (pause run after N consecutive failures), `FLI_TIMEOUT≈25s`.

### 5.4 Baseline + scoring module (pure, testable)
- `compute_baseline(calendar)`; `evaluate(flight, baseline, zone, profile) -> Candidate | None` (4 gates + Deal Score + `reason_text`, honouring **profile threshold overrides**). No I/O → unit-tested with fixtures.

### 5.5 Profile resolver
- **Purpose:** turn a profile into concrete scan instructions. Resolves the **date window** (relative → `[now+start, now+end]`; seasonal → next occurrence of `[season_start, season_end]`) and the **destination set** (routes whose zone ∈ profile's zones, or an explicit destination list), intersected with enabled routes.
- **Interface:** `resolve(profile, today) -> list[(route, window)]`.

### 5.6 Scanner orchestrator
- **Purpose:** run a pass: for each enabled profile → resolve → tier-1 → flag → tier-2 → score → tag with profile → dedup → persist → metrics.
- **Interface:** `run_scan()`; scheduled daily by APScheduler.

### 5.7 Persistence (repositories)
- Read/write `price_log`, `candidates`, `published_deals`, `scan_runs`. SQLAlchemy models; Alembic migrations.

### 5.8 Curator admin (internal Next.js)
- Auth-gated single-user UI: **profile-grouped** candidate queue, candidate detail, approve/edit/reject, publish form; profiles/routes/zones CRUD. Reads candidates/scan_runs; writes published_deals + candidate.status.

### 5.9 Calibration script
- One-off (re-runnable) pass that scans configured routes and seeds `zones` thresholds from **real** data. `python -m skrendam.calibrate`.

---

## 6. Data model (Postgres)

Alembic owns the schema (single source of truth). The Next.js app reads via Drizzle types from `drizzle-kit pull`; it **never runs migrations**.

**Config**
- **`zones`** — `zone` (pk, e.g. `MEDITERRANEAN`), `haul_type` (`short|medium|long`), `threshold_price_eur`, `min_abs_savings_eur`, `min_discount_pct`, `updated_at`.
- **`routes`** — `id` (pk), `origin` (VNO/KUN/RIX/PLQ), `destination` (IATA), `zone` (fk), `enabled` (bool), `cabin` (default ECONOMY), `created_at`, `updated_at`. Unique `(origin, destination)`.
- **`profiles`** — `id` (pk), `name`, `slug` (unique), `enabled` (bool), `persona` (`last_minute|plan_ahead|any`, label), `date_window_type` (`relative|seasonal`), `rel_offset_start_days` / `rel_offset_end_days` (int, for relative), `season_start` / `season_end` (text `MM-DD`, for seasonal), `included_zones` (jsonb array, null = all), `included_destinations` (jsonb array, optional explicit override), `preferred_departure_days` (jsonb, optional, e.g. `["FRI","SAT"]`), `cabin` (default ECONOMY), `min_discount_pct_override` (numeric, null → zone default), `max_price_eur_override` (numeric, null), `trip_theme` (`city|beach|any`, label), `notes`, `created_at`, `updated_at`.

**Pipeline**
- **`scan_runs`** — `id`, `started_at`, `finished_at`, `scanner_version`, `profiles_scanned` (int), `routes_scanned`, `api_calls`, `http_429s`, `candidates_found`, `errors`, `status` (`running|completed|failed`).
- **`price_log`** — `id`, `run_id` (fk), `route_id` (fk), `travel_date` (date), `price`, `currency`, `scanner_version`, `scanned_at`. Index `(route_id, travel_date)`, `(scanned_at)`. (Lean tier-1 points → baselines & history; profile-agnostic.)
- **`candidates`** — `id`, `run_id` (fk), `route_id` (fk), **`profile_id` (fk)**, `deal_group_key` (text = profile+origin+dest+date-band+price-band), `travel_date` (date), `return_date` (date, null), `price`, `baseline_price`, `discount_pct`, `deal_score`, `gate_results` (jsonb), `reason_text`, `itinerary_snapshot` (jsonb, tier-2), `search_params` (jsonb), `status` (enum `new|seen|approved|edited|rejected|expired`), `first_seen_at`, `last_seen_at`, `expires_at`. Index `(profile_id, status, deal_score desc)`; **unique on `deal_group_key`** (upsert key). On re-find, update `last_seen_at`/`price` only — `approved`/`rejected` keep their status (no resurrection).
- **`published_deals`** — `id`, `candidate_id` (fk), **`profile_id` (fk)** / `profile_slug` (denormalized for the public showcase), `headline`, `body` (null), `origin`/`destination`/`zone`, `price`/`baseline_price`/`discount_pct`, `travel_window_start`/`_end`, `booking_url`, `valid_until` (null), `last_seen_at`, `tier` (default `free`, Spec 3 hook), `status` (`live|expired|unpublished`), `published_at`.

---

## 7. Profile-driven two-tier scanning

For each scan pass (`run_scan`):

1. Open a `scan_runs` row (`status=running`, stamp `scanner_version`).
2. For each **enabled profile** P:
   1. **Resolve** P → list of `(route, window)` (date window + destination set; §5.5).
   2. For each `(route, window)`:
      1. **Tier-1:** `search_calendar` over the window (auto-chunked ≤61 days; served from the within-run cache if already fetched). Insert `(travel_date, price)` into `price_log`.
      2. **Baseline:** `compute_baseline(calendar)` (min / median / cheapest-decile) within the window.
      3. **Flag** dates below the anomaly cut **or** below the effective threshold (`profile.min_discount_pct_override`/`max_price_eur_override` → else `zone` defaults).
      4. **Tier-2:** `search_flights` on flagged dates; take the cheapest sane itinerary; if `preferred_departure_days` set, prefer those.
      5. **Score:** `evaluate(flight, baseline, zone, profile)` → 4 gates; if passed, build a `Candidate` **tagged with `profile_id`**.
      6. **Dedup/upsert** on `deal_group_key` (includes profile, so the same fare can legitimately appear under two profiles' queues); else insert `status=new`.
      7. On `ScanError`: increment `errors`, log, **continue**.
3. Close `scan_runs` (counts incl. `profiles_scanned`, `finished_at`).
4. Expire stale candidates (`expires_at` passed / unseen N days) → `expired`.

---

## 8. Scoring / triage

**Philosophy:** a candidate generator for the curator, not a deal oracle (validated against Going / Hopper / Google Flights: price-vs-typical dominates; itinerary quality is a separate axis).

**Four gates:** (1) **price-anomaly** *(hard)* — below the route's window-relative baseline or the effective threshold; (2) **itinerary-sanity** *(hard)* — reject junk routings (tier-2 fields); (3) **marketability** — absolute €/% savings + psychological thresholds; (4) **freshness/urgency** — near-term/short-window.

Thresholds are **per-profile with zone fallback** — e.g. a "last-minute" profile may accept smaller discounts (urgency), a "plan-ahead" profile demands bigger ones.

**Deal Score (ranks each profile's queue)** — research-tuned seeds:
`0.50·price_anomaly + 0.20·itinerary_quality + 0.15·bookability + 0.15·urgency`

> **Bookability in v1 is derived from the itinerary** (`self_transfer=false`, single known carrier, `mixed_cabin=false`), **not `get_booking_options`** (empty server-side). The per-flight `booking_url` deep link is always attached.

**Send rule:** `deal_score > threshold` **AND** price-anomaly strong on its own **AND** itinerary-quality clears a floor.

**Weights are seeds.** Every approve/reject is labelled training data; `gate_results` + `search_params` are persisted so candidates can be re-scored / weights refit after a few weeks.

---

## 9. Scanner operations

- **Process model:** one **warm, long-lived worker** (one cold start ~6.8s, then ~1s/call). APScheduler triggers `run_scan` **daily**. Never spawn a process per route/profile.
- **Pacing:** ~1 call / 1–2s + jitter, `FLI_TIMEOUT≈25s`, our exponential backoff on 429/timeout, circuit-breaker. The within-run `(route, window)` cache avoids redundant calls across overlapping profiles.
- **Throughput:** profiles share a small route universe; with the cache, tier-1 ≈ a few hundred calls, tier-2 only on flagged dates → comfortably < ~30 min on a warm worker.
- **Host:** Railway / Fly / small VPS, Python ≤3.13, deps via `uv`.

---

## 10. Curator admin (internal Next.js)

- **Stack:** Next.js (App Router) + TypeScript on Vercel; Postgres via **Drizzle** (`drizzle-kit pull`); auth via **Auth.js Credentials** — single admin user from env (Clerk is overkill).
- **Views:**
  - **Queue, grouped by profile** — tabs/filters per profile ("Christmas city breaks (5)", "Last-minute long weekends (3)"); within a profile, sorted by Deal Score; row = route, price, % off, score, stops, dates. Plus filters: origin, status, min score.
  - **Detail** — price vs baseline, score, status; **"why it triggered"** + chips; full itinerary; `booking_url`.
  - **Publish form** — auto-suggested editable `headline`, optional `body`, `travel_window`, `valid_until`; the deal inherits the candidate's `profile`.
  - **Actions** — ✕ Reject · ✎ Save edits · ✓ Approve & Publish (writes `published_deals`, sets `candidate.status`).
  - **Profiles / routes / zones management** — CRUD for the config that drives scanning.
  - **Scan-health header** — last run, profiles/routes scanned, candidates, 429s (from `scan_runs`).
- **Permissions:** internal single user; read candidates/scan_runs, write published_deals + candidate.status + config. No deletes of pipeline data.

---

## 11. Configuration & calibration

- **Origins:** **VNO, KUN, RIX** from day one; **PLQ** optional/bonus. Adding an origin (e.g. WAW) is trivial.
- **Destination list:** curated seed of ~60–120 popular Lithuanian/Baltic destinations, each tagged to a `zone`; editable.
- **Profiles (seed set, illustrative — editable):**
  | Profile | Window | Destinations | Notes |
  |---|---|---|---|
  | Last-minute long weekends | relative 3–21d | city zones | Fri/Sat departures; smaller-discount tolerance |
  | Quick city breaks | relative 14–90d | city zones | 2–3 day urban theme |
  | Summer sun | seasonal Jun–Aug | beach zones | plan-ahead |
  | Plan-ahead summer | relative 60–180d | beach/city | bigger-discount demand |
  | Post-summer escapes | seasonal Sep–Oct | sun zones | shoulder season |
  | Christmas getaways | seasonal Dec 10–Jan 6 | city/markets | |
- **Locale:** scan in **EUR**, `language=lt`, `country=LT`.
- **Trip type:** v1 detects **one-way** fares (matches the validated path); `return_date`/round-trip are schema hooks for later.
- **Calibration:** `skrendam.calibrate` runs one real scan and seeds each zone's thresholds from observed fares (re-runnable). Required before "go live".

---

## 12. Tech stack & deployment

| Layer | Choice |
|---|---|
| Scanner | Python 3.13, `uv`, `fli` (`flights` pkg), SQLAlchemy + Alembic, APScheduler |
| Scanner host | Railway / Fly / small VPS (always-on) |
| Web (internal admin) | Next.js (App Router) + TypeScript on Vercel, Drizzle, Auth.js |
| Database | Neon Postgres (Vercel Marketplace) |
| Schema source of truth | Alembic (Python); web introspects via `drizzle-kit pull` |
| Shared secrets | `DATABASE_URL`, `FLI_TIMEOUT`, admin auth secret |

---

## 13. Error handling & observability

- The `fli` adapter maps failures to typed `ScanError`s; a failing route/profile increments `scan_runs.errors` and is logged — **never silently swallowed**, never aborts the whole run.
- 429s and timeouts counted in `scan_runs` to tune pacing.
- Structured logs per run; the admin scan-health header surfaces the latest run.

---

## 14. Testing

- **Scoring/baseline/profile-resolver:** unit tests with **recorded fixtures** (sample `SearchDates`/`SearchFlights` JSON captured live; profile resolution against a fixed "today") — deterministic, no network.
- **Adapter/pacing:** `fli` mocked — verify pacing, backoff, circuit-breaker, within-run cache, error mapping.
- **No live API in CI** (flaky/429); one optional live smoke test gated by `FLI_E2E`.
- **Admin:** integration test of approve→publish against a test DB.

---

## 15. Build sequence (milestones)

1. DB schema + Alembic migrations + seed `zones`/`routes`/`profiles`.
2. `fli` adapter + pacing/backoff + within-run cache.
3. Profile resolver.
4. Tier-1 scan + `price_log` + baseline.
5. Scoring module + tier-2 + `candidates` (profile-tagged, dedup/upsert).
6. `scan_runs` metrics + APScheduler.
7. Calibration script + first real calibration.
8. Internal curator admin: profile-grouped queue → detail → approve/publish + config CRUD + auth.
9. End-to-end dry run on real data; tune thresholds & weights.

---

## 16. Risks & how this design addresses them

(Full analysis in the review brief.)

| Risk | Status in Spec 1 |
|---|---|
| **R2 deal supply** | Live-validated; RIX added; PLQ bonus; profiles focus the search on saleable segments. |
| **R0 audience conversion** | Tested manually on the side; public side (Spec 2) is deliberately minimal (deals + email). |
| **R1 legal/data source + affiliate** | `fli` accepted **for this internal phase only**; production data/affiliate path tracked separately, does not block Spec 1. |
| **R3 mistake-fare freshness** | Downgraded; once-daily scan; brand on curated deals (a "last-minute" profile covers urgency lightly). |
| **R4 cold-start baseline** | Window-relative + calibrated zone thresholds; SerpApi `price_insights` flagged as optional future benchmark. |
| **Timeouts / 429** | Live-tested clean; warm worker + our pacing/backoff/circuit-breaker + within-run cache + `scan_runs` tracking. |

## 17. Deferred (not blocking the build)

Public site + deals showcase + email capture (Spec 2); monetization — segmented newsletters, paid tiers, affiliate (Spec 3+, "next phase"); production/affiliate data source (R1); intra-day/mistake-fare cadence; SerpApi baseline (R4); round-trip detection; everything in §3 "out of scope".
