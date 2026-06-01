# Spec 1 — Deal Engine + Curator (Design)

- **Status:** Proposed — awaiting review
- **Date:** 2026-06-01
- **Project:** Skrendam (Lithuanian/Baltic flight-deal membership; deal-club model)
- **Related:** [`docs/research/2026-06-01-deal-engine-v1-review-brief.md`](../../research/2026-06-01-deal-engine-v1-review-brief.md) (risk analysis, live validation, alternatives considered)

---

## 1. Summary

A **private, hybrid deal engine**. A paced Python scanner reuses the `fli` library to scan a curated set of routes from Lithuanian/Baltic origins, scores each fare into a ranked queue of **deal candidates**, and a Next.js **curator admin** lets the founder approve / edit / reject those candidates into a `published_deals` table.

The automated **loop surfaces** candidates; the **human curates**. No public site, signup, newsletter, or billing — those are later specs. The single goal of this spec is to prove we can **reliably produce a daily stream of genuinely good deals without getting blocked**, before investing in any consumer-facing product.

This design is **live-validated**: `fli` was installed (Python 3.13) and run against real Lithuanian routes on 2026-06-01 (e.g. VNO→STN €17, VNO→BCN €30, KUN→AGP €57), with no 429s/timeouts and warm calls ~1s. See §2A of the review brief.

---

## 2. Goal & success criteria

Spec 1 is "done" when:

1. The scanner runs a full daily pass over the configured routes (VNO, KUN, RIX; PLQ optional) **without sustained HTTP 429s** (tracked in `scan_runs`).
2. It produces a **ranked queue of credible deal candidates**, each with a price-vs-baseline figure and a plain-language "why it triggered."
3. The curator can **triage the queue to `published_deals` in a few minutes/day** from the admin.
4. `price_log` accumulates per-scan price history (foundation for smarter baselines later).
5. The whole pass completes in a practical window (target: **full daily scan < ~30 min** on a warm worker).

These are acceptance signals, not hard SLAs; thresholds are tunable.

---

## 3. Scope

**In scope:** Postgres schema + migrations; route/zone config; the `fli` adapter (pacing/backoff/timeout); two-tier scanner; baseline + scoring/triage; candidate persistence with lifecycle + dedup; `scan_runs` ops metrics; a one-off calibration script; the Next.js curator admin (auth-gated, single user) with approve/edit/reject → publish.

**Out of scope (deferred to later specs):** public website, SEO pages, newsletter signup/sending, user accounts, Stripe/billing, premium gating, push/email alerts, the automated distribution adapter (Telegram auto-post / email capture), Elite tier, ancillary partners, B2B, mobile app, multi-language content.

**Run on the side, no build:** audience-conversion testing (TikTok → Telegram/email) is done manually by the founder; it is not part of this build.

---

## 4. Architecture

```
        ✈ Google Flights  (external, rate-limited)
                 ▲  our pacing (~1 call/1–2s + jitter) · backoff · circuit-breaker
                 │  (on top of fli's built-in 10/sec + 3 retries + FLI_TIMEOUT)
        ┌────────┴───────────────┐
        │  Python Scanner Worker  │  warm, long-lived service · off-Vercel
        │  (Railway/Fly/VPS)      │  Python ≤3.13 · imports the `fli` library
        │  APScheduler (daily)    │
        └────────┬───────────────┘
                 │ tier-1: SearchDates calendar → price_log
                 │ tier-2: SearchFlights (anomalies only) → scoring → candidates
                 ▼
        ┌────────────────────┐
        │      Postgres       │  Neon (Vercel Marketplace)
        │  routes · zones ·   │  Alembic = single source of truth for schema
        │  scan_runs ·        │
        │  price_log ·        │
        │  candidates ·       │
        │  published_deals    │
        └────────┬───────────┘
                 │ reads candidate queue · writes published_deals + candidate.status
                 ▼
        ┌────────────────────┐
        │  Curator Admin       │  Next.js (App Router) on Vercel · auth-gated · single user
        └────────────────────┘
                 │
                 ▼  (Spec 2 reads published_deals)
```

The two deployables (Python worker, Next.js admin) are **loosely coupled** — they share only Postgres.

---

## 5. Components

Each unit has one clear purpose, a defined interface, and stated dependencies.

### 5.1 Config store (`routes`, `zones`)
- **Purpose:** the editable definition of *what to scan* and *what "cheap" means per destination zone*.
- **Interface:** Postgres tables, CRUD via the curator admin.
- **Depends on:** Postgres.

### 5.2 `fli` adapter
- **Purpose:** the only place that touches `fli`. Wraps `SearchDates` / `SearchFlights`, applies our pacing/backoff/timeout, maps errors to typed results.
- **Interface:** `search_calendar(origin, dest, window, *, currency, locale) -> list[DatePoint]`; `search_flights(origin, dest, date, *, filters) -> list[FlightResult]`. Both raise a typed `ScanError` (timeout / rate-limited / connection / parse) on failure.
- **Depends on:** `fli` (Python lib), pacing layer (5.3).

### 5.3 Pacing / backoff layer
- **Purpose:** keep us well under Google's ceiling and survive throttling.
- **Behaviour:** local token bucket (~1 call / 1–2s + jitter), exponential backoff on 429/timeout, circuit-breaker (pause the run after N consecutive failures), `FLI_TIMEOUT≈25s`.
- **Interface:** `await pace()` gate + `with backoff(): ...` wrapper used by the adapter.

### 5.4 Baseline + scoring module (pure, testable)
- **Purpose:** decide "is this a candidate, and how good?" with **no I/O**.
- **Interface:** `compute_baseline(calendar) -> Baseline`; `evaluate(flight, baseline, zone) -> Candidate | None` (runs the 4 gates, computes Deal Score + `reason_text`).
- **Depends on:** nothing (operates on plain data) → unit-tested with recorded fixtures.

### 5.5 Scanner orchestrator
- **Purpose:** run a scan pass: load routes → tier-1 → flag → tier-2 → score → dedup → persist → record metrics.
- **Interface:** `run_scan()` entrypoint; scheduled by APScheduler (daily for v1).
- **Depends on:** 5.1–5.4, 5.6.

### 5.6 Persistence (repositories)
- **Purpose:** read/write `price_log`, `candidates`, `published_deals`, `scan_runs`.
- **Interface:** repository functions; SQLAlchemy models; Alembic migrations.
- **Depends on:** Postgres.

### 5.7 Curator admin (Next.js)
- **Purpose:** the human-in-the-loop UI.
- **Interface:** auth-gated web app — queue list, candidate detail, approve/edit/reject, publish form; reads candidates/scan_runs, writes published_deals + candidate.status.
- **Depends on:** Postgres (via Drizzle), Auth.js.

### 5.8 Calibration script
- **Purpose:** one-off (re-runnable) pass that scans the configured routes and seeds `zones` thresholds/baselines from **real** data (not guesses).
- **Interface:** `python -m skrendam.calibrate`.

---

## 6. Data model (Postgres)

Alembic owns the schema (single source of truth). The Next.js app reads it via Drizzle types generated by introspection (`drizzle-kit pull`); the web app **never runs migrations**.

**Config**
- **`zones`** — `zone` (pk, text, e.g. `WESTERN_EUROPE`), `haul_type` (`short|medium|long`), `threshold_price_eur` (numeric), `min_abs_savings_eur` (numeric), `min_discount_pct` (numeric), `updated_at`.
- **`routes`** — `id` (pk), `origin` (text: VNO/KUN/RIX/PLQ), `destination` (text, IATA), `zone` (fk→zones), `enabled` (bool), `scan_window_days` (int, default 120), `cabin` (text, default ECONOMY), `round_trip` (bool, default false), `trip_len_days` (int, null), `created_at`, `updated_at`. Index: `(origin, destination)` unique; `(enabled)`.

**Pipeline**
- **`scan_runs`** — `id` (pk), `started_at`, `finished_at`, `scanner_version` (text), `routes_scanned` (int), `api_calls` (int), `http_429s` (int), `candidates_found` (int), `errors` (int), `status` (`running|completed|failed`).
- **`price_log`** — `id` (pk), `run_id` (fk), `route_id` (fk), `travel_date` (date), `price` (numeric), `currency` (text), `scanner_version` (text), `scanned_at`. Index: `(route_id, travel_date)`, `(scanned_at)`. (Lean tier-1 points → baselines & history.)
- **`candidates`** — `id` (pk), `run_id` (fk), `route_id` (fk), `deal_group_key` (text, dedup = origin+dest+date-band+price-band), `travel_date` (date), `return_date` (date, null), `price` (numeric), `baseline_price` (numeric), `discount_pct` (numeric), `deal_score` (numeric), `gate_results` (jsonb), `reason_text` (text), `itinerary_snapshot` (jsonb, tier-2), `search_params` (jsonb, for re-scoring), `status` (enum: `new|seen|approved|edited|rejected|expired`), `first_seen_at`, `last_seen_at`, `expires_at`. Index: `(status, deal_score desc)`; **unique on `deal_group_key`** (the upsert key). On re-find, update `last_seen_at`/`price` only — a candidate already `approved`/`rejected` keeps its status (re-finding never resurrects a rejected deal).
- **`published_deals`** — `id` (pk), `candidate_id` (fk), `headline` (text), `body` (text, null), `origin`/`destination`/`zone`, `price`/`baseline_price`/`discount_pct`, `travel_window_start` (date), `travel_window_end` (date), `booking_url` (text), `valid_until` (date, null), `last_seen_at`, `tier` (text, default `free` — hook for Spec 3), `status` (`live|expired|unpublished`), `published_at`.

---

## 7. Two-tier scanning algorithm

For each scan pass (`run_scan`):

1. Open a `scan_runs` row (`status=running`, stamp `scanner_version`).
2. For each enabled `route`:
   1. **Tier-1 (broad/cheap):** `search_calendar` across `scan_window_days` (auto-chunked ≤61 days by `fli`). Insert every `(travel_date, price)` into `price_log`.
   2. **Baseline:** `compute_baseline(calendar)` → min / median / cheapest-decile.
   3. **Flag** dates whose price is below the route's anomaly cut (decile/median gap) **or** below the zone's `threshold_price_eur`.
   4. **Tier-2 (deep, anomalies only):** for each flagged date, `search_flights(date)`; take the cheapest sane itinerary.
   5. **Score:** `evaluate(flight, baseline, zone)` → runs the 4 gates; if it passes, build a `Candidate` (Deal Score, `gate_results`, `reason_text`, `itinerary_snapshot`, `search_params`).
   6. **Dedup/upsert:** compute `deal_group_key`; if a candidate for that key exists, update `last_seen_at`/price; else insert with `status=new`.
   7. Record per-route metrics; on `ScanError`, increment `errors`, log, **continue** (never abort the whole run for one route).
3. Close `scan_runs` (`status=completed`, counts, `finished_at`).

Expire stale candidates (`expires_at` passed or not seen for N days) → `status=expired`.

---

## 8. Scoring / triage

**Philosophy:** a candidate *generator for the curator*, not a deal oracle. (Researched against Going / Hopper / Google Flights: price-vs-typical is the dominant signal everywhere; itinerary quality is a separate axis.)

**Four gates** (a candidate must clear them):
1. **Price-anomaly** *(hard filter)* — below the route's own price curve (window-relative baseline) **or** the zone threshold. The signal everything hangs on.
2. **Itinerary-sanity** *(hard filter)* — reject junk: excessive stops, airport changes, impossible self-connects, brutal overnight layovers, awful arrival times. Uses tier-2 fields (`stops`, `duration`, `layovers`, `self_transfer`, `mixed_cabin`).
3. **Marketability** — enough absolute € savings **and/or** % discount **and/or** a psychological threshold (zone `min_abs_savings_eur` / `min_discount_pct`).
4. **Freshness / urgency** — near-term / short-window. Mild for v1 (curation-led, not mistake-fare hunting).

**Deal Score (ranks the queue)** — weighted seeds (research-tuned):
`0.50·price_anomaly + 0.20·itinerary_quality + 0.15·bookability + 0.15·urgency`

**Send rule:** `deal_score > threshold` **AND** price-anomaly strong on its own **AND** itinerary-quality clears a floor.

> **Bookability in v1 is derived from the itinerary, not `get_booking_options`** (which returns empty vendor fares server-side). Signals: `self_transfer=false`, single operating airline, a known/reputable carrier, `mixed_cabin=false`. The per-flight `booking_url` deep link is always attached regardless.

**The weights are seeds, not the product.** Every approve/reject the curator makes is labelled training data; after a few weeks, refit the weights (or a small logistic model) to predict "would the curator approve this?" `gate_results` + `search_params` are persisted precisely so candidates can be re-scored later.

---

## 9. Scanner operations

- **Process model:** a single **warm, long-lived worker** (one cold start ~6.8s, then ~1s/call). APScheduler triggers `run_scan` **once daily** for v1 (architecture allows intra-day later). Never spawn a process per route.
- **Pacing:** ~1 call / 1–2s + jitter (far under the 10/sec ceiling), `FLI_TIMEOUT≈25s`, our own exponential backoff on 429/timeout, circuit-breaker pauses the run after N consecutive failures.
- **Throughput:** ~3 origins × ~80–120 destinations = a few hundred tier-1 calls; tier-2 only on flagged dates (a small fraction). Comfortably within the <~30 min target on a warm worker.
- **Host:** Railway / Fly / small VPS, Python ≤3.13, deps via `uv`.

---

## 10. Curator admin (Next.js)

- **Stack:** Next.js (App Router) + TypeScript on Vercel; Postgres via **Drizzle** (types from `drizzle-kit pull`); auth via **Auth.js (NextAuth) Credentials** — a single admin user from env (Clerk is overkill for one user).
- **Views:**
  - **Queue** — candidates sorted by Deal Score; filters: origin, status, min score. Compact rows: route, price, % off, score, stops, dates.
  - **Detail** — price vs baseline, score, status; **"why it triggered"** + chips; full itinerary (legs/times/flight numbers); `booking_url` deep link.
  - **Publish form** — auto-suggested editable `headline`, optional `body`, `travel_window`, `valid_until`.
  - **Actions** — ✕ Reject · ✎ Save edits · ✓ Approve & Publish (writes `published_deals`, sets `candidate.status`).
  - **Scan-health header** — last run, routes scanned, candidates, 429s (from `scan_runs`).
- **Permissions:** read candidates/scan_runs; write published_deals + candidate.status. No deletes of pipeline data.

---

## 11. Configuration & calibration

- **Origins (decided):** **VNO, KUN, RIX** from day one; **PLQ** optional/bonus. `routes` is designed so adding an origin (e.g. WAW) is trivial.
- **Destination list:** a curated seed of ~60–120 popular Lithuanian/Baltic destinations (sun routes, city breaks, major hubs), each tagged to a `zone`. Shipped as seed data; editable in admin.
- **Locale:** scan in **EUR**, `language=lt`, `country=LT`.
- **Trip type:** v1 detects **one-way** fares (matches the validated path and the simplest `SearchDates` call). `routes.round_trip` / `candidates.return_date` exist as schema hooks; round-trip detection is a fast-follow, not v1.
- **Calibration:** `skrendam.calibrate` runs one full real scan and seeds each zone's `threshold_price_eur` / `min_abs_savings_eur` / `min_discount_pct` from observed fares (re-runnable as routes change). Required before "go live" so thresholds reflect reality, not guesses.

---

## 12. Tech stack & deployment

| Layer | Choice |
|---|---|
| Scanner | Python 3.13, `uv`, `fli` (`flights` pkg), SQLAlchemy + Alembic, APScheduler |
| Scanner host | Railway / Fly / small VPS (always-on) |
| Web | Next.js (App Router) + TypeScript on Vercel, Drizzle, Auth.js |
| Database | Neon Postgres (Vercel Marketplace) |
| Schema source of truth | Alembic (Python); web introspects via `drizzle-kit pull` |
| Shared secrets | `DATABASE_URL`, `FLI_TIMEOUT`, admin auth secret |

---

## 13. Error handling & observability

- The `fli` adapter maps failures to typed `ScanError`s; a failing route increments `scan_runs.errors` and is logged — **never silently swallowed**, never aborts the whole run.
- 429s and timeouts are counted in `scan_runs` to tune pacing.
- Structured logs per run; the admin's scan-health header surfaces the latest run at a glance.

---

## 14. Testing

- **Scoring/baseline (5.4):** unit tests with **recorded fixtures** (sample `SearchDates`/`SearchFlights` JSON captured from the live run) — deterministic, no network.
- **Adapter/pacing (5.2–5.3):** tests with `fli` mocked — verify pacing, backoff, circuit-breaker, error mapping.
- **No live API in CI** (flaky/429). One optional live smoke test gated behind an env flag (`FLI_E2E`).
- **Admin:** integration test of the approve→publish flow against a test DB.

---

## 15. Build sequence (milestones)

A detailed step plan comes from the writing-plans step; high-level order:

1. DB schema + Alembic migrations + seed `routes`/`zones`.
2. `fli` adapter + pacing/backoff layer.
3. Tier-1 scan + `price_log` + baseline.
4. Scoring module + tier-2 + `candidates` (dedup/upsert).
5. `scan_runs` metrics + APScheduler.
6. Calibration script + first real calibration.
7. Curator admin: queue → detail → approve/publish + auth.
8. End-to-end dry run on real data; tune thresholds & weights.

---

## 16. Risks & how this design addresses them

(Full analysis in the review brief.)

| Risk | Status in Spec 1 |
|---|---|
| **R2 deal supply** | Live-validated as real on Baltic budget routes; RIX added; PLQ bonus. Build proves volume. |
| **R0 audience conversion** | Tested manually on the side (out of this build). |
| **R1 legal/data source + affiliate** | `fli` accepted **for this private phase only**; production data/affiliate path tracked separately (does not block Spec 1). |
| **R3 mistake-fare freshness** | Downgraded; once-daily scan is enough; brand on curated deals. |
| **R4 cold-start baseline** | Window-relative + calibrated zone thresholds; SerpApi `price_insights` flagged as an optional future benchmark. |
| **Timeouts / 429** | Live-tested clean; mitigated by warm worker + our pacing/backoff/circuit-breaker + `scan_runs` tracking. |

## 17. Deferred (not blocking the build)

Production/affiliate data source (R1), audience-conversion channel (R0), intra-day/mistake-fare cadence (R3), SerpApi `price_insights` baseline (R4), and everything in §3 "out of scope."
