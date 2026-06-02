# Spec 1 — Internal Deal Engine + Curator (Design)

- **Status:** Proposed — awaiting review (v3 — Structured Deal Templates, Approach B)
- **Date:** 2026-06-01 · **Revised:** 2026-06-02
- **Project:** Skrendam (Lithuanian/Baltic flight deals; grow a travel-deal email audience)
- **Related:** [`docs/research/2026-06-01-deal-engine-v1-review-brief.md`](../../research/2026-06-01-deal-engine-v1-review-brief.md)

---

## 1. Summary

An **internal-only** deal-finding tool built on **structured deal templates** (Approach B). It does *not* build a generic flight search for users, nor an abstract rules engine. It is a curation system around three concepts:

- **`audience_segments`** — *who* the deal is for (families, couples, flexible adults, budget travelers…).
- **`travel_moments`** — *when/why* they travel (school holidays, September shoulder season, last warm days, Christmas markets, last-minute weekends, plan-ahead summer…).
- **`deal_templates`** — reusable search strategies combining an audience + a moment + concrete scan/filter rules.

> The product is *"find specific types of deals for specific people at specific travel moments, then let the curator approve what gets published."*

A paced Python scanner reuses the `fli` library to run each enabled template, stores **one candidate per real fare**, and links it to every template it matches via **`candidate_template_matches`** (so one VNO→Cyprus November fare can match "November sun", "Last warm days", and "Couples shoulder-season" without duplicating the fare). A Next.js **curator admin** shows candidates grouped by template — who it's for, why it matched, what's bad about it, a suggested headline + TikTok hook — and the founder approves/rejects what gets published.

**Internal-only:** only the founder uses this tool. End users never touch search. The public side (a later, minimal spec) shows *only* curator-selected deals + newsletter CTAs. Near-term goal: grow an email list of travel-deal leads. Monetization is a deferred phase.

Live-validated: `fli` runs on real Lithuanian routes (VNO→STN €17, VNO→BCN €30), warm calls ~1s, no 429s (review brief §2A).

### Build order
1. **Spec 1 — Internal deal engine + curator (structured templates)** ← *this doc*. Founder-only.
2. **Spec 2 — Minimal public site:** curated deals (grouped by `public_label`) + **plain email capture** + newsletter CTAs. No accounts/billing.
3. **Spec 3+ — Monetization (next phase):** segmented newsletters (reuse `newsletter_tag`), paid tiers, affiliate. Deferred.

---

## 2. Goal & success criteria

Done when:
1. The scanner runs a daily pass across **enabled deal_templates** (one-way *and* round-trip) without sustained 429s (`scan_runs`).
2. It produces **candidates grouped by matched template**, each with price-vs-baseline, a match score, and a plain-language "why it matched."
3. The curator can triage to `published_deals` in a few minutes/day, each deal tagged with its template.
4. `price_log` accumulates per-scan history.
5. A full daily pass completes in a practical window (target **< ~30 min** warm).

---

## 3. Scope

**In scope:** Postgres schema + migrations; `zones`/`routes` config; the structured **`audience_segments` / `travel_moments` / `deal_templates` / `candidate_template_matches`** model; the `fli` adapter (pacing/backoff/timeout, one-way + round-trip); template resolver; two-tier scanner; baseline + per-template scoring/matching; **one-candidate-per-fare** persistence with lifecycle + dedup; `scan_runs` metrics; calibration script; the **internal** Next.js curator admin (auth-gated, single user).

**Out of scope (later):** public website + deals showcase + email capture (Spec 2); accounts, billing, premium gating, segmented newsletter delivery, paid tiers, affiliate (Spec 3+); push/SMS alerts; mobile app.

**Hard rule:** internal-only. No end-user access to search, templates, or the candidate queue. Externally users see only curator-selected `published_deals` + a newsletter CTA.

---

## 4. Architecture

```
        ✈ Google Flights  (external, rate-limited)
                 ▲  our pacing (~1 call/1–2s + jitter) · backoff · circuit-breaker
        ┌────────┴───────────────┐
        │  Python Scanner Worker  │  warm, long-lived · off-Vercel · Python ≤3.13 · imports `fli`
        │  APScheduler (daily)    │  iterates ENABLED deal_templates (one-way & round-trip)
        └────────┬───────────────┘
                 │ tier-1: SearchDates calendar (per template window/trip_type) → price_log
                 │ tier-2: SearchFlights (anomalies only) → 1 candidate/fare
                 │ match:  evaluate candidate vs every matching template → candidate_template_matches
                 ▼
        ┌────────────────────────────────────────────────┐
        │ Postgres (Neon) — Alembic = schema source of truth │
        │ zones · routes · audience_segments · travel_moments │
        │ deal_templates · scan_runs · price_log              │
        │ candidates · candidate_template_matches · published_deals │
        └────────┬───────────────────────────────────────┘
                 │ reads queue (grouped by template) · writes published_deals + candidate.status
                 ▼
        ┌────────────────────┐
        │  Curator Admin       │  Next.js · INTERNAL · auth-gated · single user
        └────────────────────┘
                 ▼  (Spec 2 reads published_deals → minimal public showcase + email capture)
```

---

## 5. Components

### 5.1 Config store
`zones`, `routes`, `audience_segments`, `travel_moments`, `deal_templates` — editable via the admin.

### 5.2 `fli` adapter
The only code touching `fli`. Wraps `SearchDates`/`SearchFlights` for **both one-way and round-trip**, applies pacing/backoff/timeout, maps errors to `ScanError`. Within-run **fetch cache** keyed by `(route, trip_type, duration, window)` so overlapping templates don't re-request.

### 5.3 Pacing / backoff layer
Token bucket (~1 call/1–2s + jitter), exponential backoff on 429/timeout, circuit-breaker, `FLI_TIMEOUT≈25s`.

### 5.4 Template resolver
Turns a `deal_template` into concrete searches: resolves the **date window** (`relative` → `[now+start, now+end]`; `seasonal` → next `[season_start, season_end]`; `fixed` → the fixed dates), the **destination set** (routes whose zone ∈ `included_zones`, plus `included_destinations`, minus `excluded_destinations`; honour `included_origins` + `nearby_origins_allowed`), the **trip_type** (one-way, or round-trip at a representative duration derived from `trip_len_min/max_days`), and **departure-day** preferences. Interface: `resolve(template, today) -> list[SearchSpec]`.

### 5.5 Baseline + matching module (pure, testable)
`compute_baseline(calendar)`; `match(candidate, template, baseline, zone) -> Match | None` — runs the gates with the **template's** filter rules (fallback to zone defaults), computes a **match_score** (template-specific) + `reason_text` + `gate_results`. No I/O → fixture-tested.

### 5.6 Scanner orchestrator
Runs the 10-step pass (§7): per template → resolve → tier-1 → flag → tier-2 → upsert one candidate/fare → match vs all applicable templates → write `candidate_template_matches` → metrics.

### 5.7 Persistence (repositories)
Read/write all pipeline tables; SQLAlchemy + Alembic.

### 5.8 Curator admin (internal Next.js)
Auth-gated single-user UI; template-grouped queue + rich candidate detail (§10). Reads candidates/matches/scan_runs; writes published_deals + candidate.status.

### 5.9 Calibration script
One-off re-runnable pass seeding `zones` thresholds from real data.

---

## 6. Data model (Postgres)

Alembic owns the schema. The Next.js app reads via Drizzle types from `drizzle-kit pull`; never migrates.

**Config — geography**
- **`zones`** — `zone` (pk), `haul_type` (`short|medium|long`), `threshold_price_eur`, `min_abs_savings_eur`, `min_discount_pct`, `updated_at`.
- **`routes`** — `id` (pk), `origin` (VNO/KUN/RIX/PLQ), `destination` (IATA), `zone` (fk), `enabled`, `cabin` (default ECONOMY), timestamps. Unique `(origin, destination)`.

**Config — structured templates**
- **`audience_segments`** — `id` (pk), `slug` (unique), `name`, `description`, `default_itinerary_tolerance` (`strict|normal|relaxed`), timestamps.
- **`travel_moments`** — `id` (pk), `slug` (unique), `name`, `description`, `moment_type` (`seasonal|relative|fixed_dates|recurring`), `default_content_angle`, timestamps.
- **`deal_templates`** — `id` (pk), `slug` (unique), `name`, `enabled`, `audience_segment_id` (fk), `travel_moment_id` (fk), `priority` (int), `trip_type` (`oneway|roundtrip`), `newsletter_tag`, `public_label`, `notes`, timestamps.
  - *Origins/destinations:* `included_origins` (jsonb), `included_zones` (jsonb), `included_destinations` (jsonb, optional), `excluded_destinations` (jsonb), `nearby_origins_allowed` (bool).
  - *Date/timing:* `date_window_type` (`relative|seasonal|fixed`), `rel_offset_start_days`, `rel_offset_end_days`, `season_start_mmdd`, `season_end_mmdd`, `fixed_start_date`, `fixed_end_date`, `preferred_departure_days` (jsonb), `preferred_return_days` (jsonb, round-trip), `trip_len_min_days`, `trip_len_max_days`.
  - *Fare/value:* `max_price_eur`, `min_discount_pct`, `min_abs_savings_eur`, `psychological_price_threshold_eur`, `allow_smaller_discount_if_under_price` (bool).
  - *Itinerary quality:* `cabin`, `max_stops`, `max_total_duration_minutes`, `max_layover_minutes`, `min_layover_minutes`, `allow_overnight_layover`, `allow_airport_change`, `allow_self_transfer`, `allow_mixed_cabin`, `prefer_direct`, `family_friendly_times_only`, `latest_arrival_hour`, `earliest_departure_hour`.
  - *Content/publishing:* `content_angle`, `suggested_headline_template`, `tiktok_hook_template`, `newsletter_section`, `publish_channel_default` (`public|newsletter|premium_future`), `rules_json` (jsonb — escape hatch only).

**Pipeline**
- **`scan_runs`** — `id`, `started_at`, `finished_at`, `scanner_version`, `templates_scanned`, `routes_scanned`, `api_calls`, `http_429s`, `candidates_found`, `matches_created`, `errors`, `status` (`running|completed|failed`).
- **`price_log`** — `id`, `run_id` (fk), `route_id` (fk), `trip_type`, `travel_date` (date), `return_date` (date, null), `price`, `currency`, `scanner_version`, `scanned_at`. Index `(route_id, trip_type, travel_date)`, `(scanned_at)`. (Lean tier-1 points; template-agnostic.)
- **`candidates`** — **one row per real fare**: `id`, `run_id` (fk), `route_id` (fk), `origin`, `destination`, `zone`, `trip_type`, `travel_date` (date), `return_date` (date, null), `price`, `currency`, `baseline_price`, `discount_pct`, `itinerary_snapshot` (jsonb, tier-2), `search_params` (jsonb), `status` (enum `new|seen|approved|edited|rejected|expired`), `rejection_reason` (text, null), `first_seen_at`, `last_seen_at`, `expires_at`, `scanner_version`. **Unique `deal_group_key`** = `origin+dest+trip_type+travel_date(+return_date)+price-band` (fare identity; upsert key — **not** template-based). On re-find update `last_seen_at`/`price` only; `approved`/`rejected` keep their status.
- **`candidate_template_matches`** — `id`, `candidate_id` (fk), `deal_template_id` (fk), `match_score` (numeric), `reason_text`, `gate_results` (jsonb), `created_at`. Unique `(candidate_id, deal_template_id)`. (This is what makes "one fare → many templates" work and powers the template-grouped queue + "matched N templates.")
- **`published_deals`** — `id`, `candidate_id` (fk), `deal_template_id` (fk), `public_label` / `newsletter_tag` (denormalized from template), `headline`, `body` (null), `tiktok_hook` (null), `origin`/`destination`/`zone`, `trip_type`, `travel_date`/`return_date`, `price`/`baseline_price`/`discount_pct`, `booking_url`, `valid_until` (null), `last_seen_at`, `tier` (default `free`), `status` (`live|expired|unpublished`), `published_at`. A candidate may be published under more than one template (one row each).

---

## 7. Scanner flow

For each scan pass (`run_scan`), open a `scan_runs` row, then:

1. **Load** enabled `deal_templates`.
2. **Resolve** each template → concrete route/date/trip_type searches (§5.4).
3. **Fetch calendar** prices through the `fli` adapter (tier-1; within-run cache).
4. **Store** price points in `price_log`.
5. **Identify anomalous dates** using the template's thresholds → zone fallback (vs the window-relative baseline).
6. **Fetch detailed flights** for flagged dates (tier-2); take the cheapest sane itinerary.
7. **Create or update one `candidate`** per real fare (upsert on `deal_group_key`).
8. **Evaluate** that candidate against **every applicable template** (same `trip_type`; fare's date inside the template's window; origin/zone/destination in scope) — not only the template that fetched it.
9. **Insert/refresh `candidate_template_matches`** (match_score, reason_text, gate_results) for each template it passes.
10. Record metrics; on `ScanError` increment `errors`, log, **continue**.

Close `scan_runs` (counts incl. `templates_scanned`, `matches_created`). Expire stale candidates (`expired`).

> Round-trip templates scan via `SearchDates` round-trip mode at a **representative duration** (default `trip_len_min_days`; a small set of durations can be scanned later if needed). One-way templates use one-way `SearchDates`. `trip_type` must align for a match (a one-way fare never matches a round-trip template).

---

## 8. Scoring / matching

**Philosophy:** a candidate generator for the curator (validated against Going / Hopper / Google Flights — price-vs-typical dominates; itinerary quality is a separate axis).

Each `candidate_template_matches` row is produced by `match(candidate, template, baseline, zone)`:

**Gates** (using the **template's** rules, zone fallback): (1) **price-anomaly** *(hard)* — below window-relative baseline or `max_price_eur`/`min_discount_pct`; (2) **itinerary-sanity** *(hard)* — honour `max_stops`, `max_total_duration_minutes`, layover bounds, `allow_overnight_layover`/`allow_airport_change`/`allow_self_transfer`/`allow_mixed_cabin`, `latest_arrival_hour`/`earliest_departure_hour`/`family_friendly_times_only`; (3) **marketability** — `min_abs_savings_eur` / `min_discount_pct` / `psychological_price_threshold_eur` (`allow_smaller_discount_if_under_price` relaxes the discount when price is under the psychological threshold); (4) **freshness/urgency** — near-term/short-window.

**match_score** (ranks each template's queue) — research-tuned seeds:
`0.50·price_anomaly + 0.20·itinerary_quality + 0.15·bookability + 0.15·urgency`
(The same fare can score differently under different templates — a family template penalizes bad times that a budget template tolerates.)

> **Bookability in v1 is derived from the itinerary** (`self_transfer=false`, single known carrier, `mixed_cabin=false`), **not `get_booking_options`** (empty server-side). The per-flight `booking_url` deep link is always attached.

**Match rule:** keep the match if `match_score > threshold` **AND** price-anomaly strong on its own **AND** itinerary clears the template's floor.

**Weights are seeds.** Approve/reject is labelled training data; `gate_results` + `search_params` persisted so matches can be re-scored / weights refit later.

---

## 9. Scanner operations

- **Process model:** one **warm, long-lived worker**; APScheduler triggers `run_scan` **daily**. Never a process per template/route.
- **Pacing:** ~1 call/1–2s + jitter, `FLI_TIMEOUT≈25s`, our backoff + circuit-breaker; within-run cache dedupes overlapping template fetches.
- **Throughput:** templates share a small route universe; with the cache, tier-1 ≈ a few hundred calls, tier-2 only on flagged dates; round-trip adds a duration dimension but stays bounded → < ~30 min warm.
- **Host:** Railway / Fly / small VPS, Python ≤3.13, `uv`.

---

## 10. Curator admin (internal Next.js)

- **Stack:** Next.js (App Router) + TypeScript on Vercel; Postgres via Drizzle (`drizzle-kit pull`); Auth.js Credentials, single admin from env.
- **Views:**
  - **Queue, grouped by template** — one section per template (`public_label`, audience, moment); candidates sorted by `match_score`. Filters: origin, trip_type, status, min score.
  - **Candidate detail** — price vs baseline + score; **who this is for** (audience_segment); **why it matched** (`reason_text` per matched template — "matched 3 templates"); **what's bad about it** (itinerary warnings: stops, long layover, bad times); full itinerary + `booking_url`; **suggested headline** (from `suggested_headline_template`) and **suggested TikTok hook** (`tiktok_hook_template`), both editable.
  - **Actions** — ✓ Approve & Publish (under one or more matched templates → `published_deals`), ✕ Reject (+ `rejection_reason`), ♻ Recheck (re-fetch this itinerary to confirm it's still live + refresh price), ✎ Save edits.
  - **Config CRUD** — audience_segments, travel_moments, deal_templates, routes, zones.
  - **Scan-health header** — last run, templates/routes scanned, candidates, matches, 429s.
- **Permissions:** internal single user; read candidates/matches/scan_runs, write published_deals + candidate.status + config. No deletes of pipeline data.

---

## 11. Configuration, seed data & calibration

- **Origins:** VNO, KUN, RIX from day one; PLQ optional/bonus; WAW easy to add (`nearby_origins_allowed`).
- **Destinations:** ~60–120 curated Lithuanian/Baltic destinations, zone-tagged; editable.
- **Locale:** scan in EUR, `language=lt`, `country=LT`.
- **Seed audience_segments:** families · couples · flexible adults · budget travelers · city-break travelers.
- **Seed travel_moments:** school holidays (seasonal) · September shoulder (seasonal) · last warm days Oct–Nov (seasonal) · Christmas markets Dec 1–23 (fixed_dates) · last-minute weekends (relative) · plan-ahead summer (relative).
- **Seed deal_templates (Approach B examples):**
  | Template | Audience | Moment | trip_type | Key rules | Content angle |
  |---|---|---|---|---|---|
  | Family school-holiday sun | families | school holidays | roundtrip | direct/1-stop, no overnight/airport-change, family-friendly times; higher price tolerance | "School-holiday sun without package prices" |
  | September sun, fewer crowds | couples/flexible | Sept shoulder | roundtrip | 3–7 days, warm zones, tolerate slightly worse times | "Still warm, fewer families, cheaper" |
  | Last warm days | flexible adults | Oct–Nov sun | roundtrip | warm zones only, strict max price, urgency↑ | "One last sun trip before winter" |
  | Christmas markets | couples/families/city | Dec 1–23 | roundtrip | long-weekend dates, central airports, 2–4 days | "Cheap Christmas-market weekends" |
  | Last-minute long weekends | budget/flexible | next 3–21d | oneway | Fri/Sat dep, under psych price, smaller discount OK | "Leave this weekend" |
  | Plan-ahead summer | families/couples | 60–180d ahead | roundtrip | bigger discount required, better itinerary quality | "Book summer early when the fare is good" |
- **Calibration:** `skrendam.calibrate` runs one real scan and seeds `zones` thresholds from observed fares (re-runnable). Required before go-live.

---

## 12. Tech stack & deployment

| Layer | Choice |
|---|---|
| Scanner | Python 3.13, `uv`, `fli` (`flights`), SQLAlchemy + Alembic, APScheduler |
| Scanner host | Railway / Fly / small VPS (always-on) |
| Web (internal admin) | Next.js (App Router) + TS on Vercel, Drizzle, Auth.js |
| Database | Neon Postgres (Vercel Marketplace) |
| Schema source of truth | Alembic; web introspects via `drizzle-kit pull` |
| Secrets | `DATABASE_URL`, `FLI_TIMEOUT`, admin auth secret |

---

## 13. Error handling & observability

Typed `ScanError`s; a failing template/route increments `scan_runs.errors` and is logged — never silently swallowed, never aborts the run. 429s/timeouts counted to tune pacing. Structured logs; admin scan-health header.

---

## 14. Testing

- **Resolver / baseline / matching:** unit tests with recorded fixtures (sample `SearchDates`/`SearchFlights` JSON; resolution against a fixed "today"; one-way *and* round-trip) — deterministic, no network.
- **Adapter/pacing:** `fli` mocked — pacing, backoff, circuit-breaker, within-run cache, error mapping, round-trip path.
- **No live API in CI**; optional live smoke test behind `FLI_E2E`.
- **Admin:** integration test of match→approve→publish against a test DB.

---

## 15. Build sequence (milestones)

1. Schema + Alembic migrations + seed zones/routes/audience_segments/travel_moments/deal_templates.
2. `fli` adapter (one-way + round-trip) + pacing/backoff + within-run cache.
3. Template resolver.
4. Tier-1 scan + `price_log` + baseline.
5. Matching module + tier-2 + `candidates` (upsert) + `candidate_template_matches`.
6. `scan_runs` metrics + APScheduler.
7. Calibration + first real calibration.
8. Internal curator admin: template-grouped queue → rich detail → approve/publish/reject/recheck + config CRUD + auth.
9. End-to-end dry run on real data; tune thresholds & weights.

---

## 16. Risks & mitigations

(Full analysis in the review brief.)

| Risk | Status |
|---|---|
| **R2 deal supply** | Live-validated; RIX added; templates focus the search on saleable segments. |
| **R0 audience conversion** | Manual side-test; public side (Spec 2) minimal; `newsletter_tag`/`audience_segment` make the list segmentable later. |
| **R1 legal/data source + affiliate** | `fli` for this internal phase only; production/affiliate path tracked separately, does not block Spec 1. |
| **R3 mistake-fare freshness** | Downgraded; daily scan; a last-minute template covers urgency lightly. |
| **R4 cold-start baseline** | Window-relative + calibrated zone thresholds; SerpApi `price_insights` flagged as optional. |
| **Timeouts / 429** | Live-tested clean; warm worker + pacing/backoff/circuit-breaker + within-run cache + `scan_runs`. |

## 17. Deferred (not blocking the build)

Public site + showcase + email capture (Spec 2); monetization — segmented newsletters, paid tiers, affiliate (Spec 3+); production/affiliate data source (R1); intra-day cadence; SerpApi baseline (R4); multi-duration round-trip scanning; everything in §3 "out of scope".
