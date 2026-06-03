# Out-of-scope register — Skrendam

Things deliberately deferred during the Plan 1 (deal engine) build + QA gauntlet. "Remembered and marked" so nothing is silently lost. Each item notes *why* it's deferred and *when/where* it should be picked up.

_Last updated: 2026-06-03, after Plan 2 milestone 2 (config editors + engine tuning) shipped (PR #3) + JFC research captured for Spec 2 (§6)._

---

## 1. Browser end-to-end journey (Playwright) — the connected flow

**Status: deferred — blocked on Plan 2 (no wired UI yet).**

Plan 1 is the **headless Python engine**. The design-system UI kits (`.claude/skills/yip-design-system/ui_kits/curator` and `…/website`) are **static React demos with mock `data.js`** — not connected to the engine/DB.

- ✅ **Done now:** Playwright smoke of both static kits — they render and basic interactions work, no real console errors (screenshots: `qa-curator-deal-desk.png`, `qa-website-deal-detail.png`).
- ✅ **Resolved (Plan 2, 2026-06-03):** the curator **publish loop** — login → **real candidates from Neon** → review room → approve & publish → `published_deals` — is built and covered by a passing Playwright journey (`web/e2e/journey.spec.ts`).
- ⏳ **Still deferred:** the **recheck** leg as an *automated* E2E (needs the live `fli` worker running; verified manually for now) and the **public site → newsletter** half of the journey (Spec 2). See §5.

## 2. Engine follow-ups surfaced by review (non-blocking)

- ~~**Per-trip-type calibration (review C5):**~~ **RESOLVED (milestone 2, PR #3)** — `matching.py` now scopes the zone ceiling to one-way templates; round-trips must clear their own `max_price_eur` or a discount. The live-tuning dry-run is also done: `skrendam analyze` over 246 real matches set `GREAT_THRESHOLD`=88 + tightened a loose template (see `docs/research/2026-06-03-tuning-analysis.md`).
- ~~**Live `booking_url` for round-trips (review C2):**~~ **RESOLVED** — verified against `fli/search/flights.py`: `build_flight_booking_url(flight: FlightResult | tuple[FlightResult, ...])` accepts both shapes and never raises (falls back to a generic URL on bad input). Passing the raw `f` is correct; passing `f[0]` would have produced outbound-only URLs for round-trips. No change needed.
- **Live-network dry-run + threshold tuning:** run `skrendam calibrate` then `skrendam run-scan --seed` against a throwaway DB on **real fares**, inspect candidate volume/quality, and tune `SEND_THRESHOLD` / `STRONG_ANOMALY_DISCOUNT` / zone thresholds **before relying on queue volume**. (Engine is live-validated for fetching; thresholds are seeded estimates.)
- **Full itinerary gates (v1 documented limitation):** only `max_stops`, `max_total_duration_minutes`, `self_transfer`, `mixed_cabin` are enforced. `allow_airport_change` / `allow_overnight_layover` are always-false (live backend doesn't populate them) and `family_friendly_times_only` / `latest_arrival_hour` / `earliest_departure_hour` / layover bounds are **not yet evaluated** (the `FareItinerary` snapshot lacks per-leg times/layovers). Capture those in `live_backend._to_itinerary` + implement the gates.
- **DB-level unique constraints:** add `UniqueConstraint` on `routes(origin, destination)` and `candidate_template_matches(candidate_id, deal_template_id)` (currently app-level only) + a migration.
- **Micro-optimizations (low priority):** dedup `_PacedBackend` vs `FliAdapter(pace=…)`; cache `_window(tpl, today)` per template in `run_scan`; bulk `UPDATE` in `_expire_stale`; replace `datetime.utcnow()` with timezone-aware time.

## 3. Not-yet-built product layers (by design)

- **Plan 2 — Internal curator admin (Next.js):** the real Deal Desk UI on the engine's schema (start from `ui_kits/curator`). Uses the `yip-design-system` skill.
- **Spec 2 — Minimal public site:** curated deals showcase (grouped by `public_label`) + plain email capture + newsletter CTAs (start from `ui_kits/website`). No accounts/billing.
- **Spec 3+ — Monetization:** segmented newsletters (reuse `newsletter_tag`), paid tiers, affiliate. Deferred.

## 4. Business-validation risks (from the review brief)

Tracked in `docs/research/2026-06-01-deal-engine-v1-review-brief.md`:
- **R0 audience conversion** — TikTok → owned audience → paid; validate manually (Telegram + no-code email capture) in parallel.
- **R1 data source + affiliate** — `fli` is fine for this private phase only; choose an EU-legal, affiliate-enabled production data source (e.g. Travelpayouts) before going paid.

## 5. Plan 2 (curator admin, Next.js) — deferred + findings

_Added 2026-06-03. The internal Deal Desk is built in `web/` and wired to real Neon data (158 candidates); login → review → publish verified end-to-end (Playwright). Branch `feat/curator-admin`._

**Plan 2 "milestone 2" — SHIPPED (2026-06-03, PR #3):**
- ✅ **Config CRUD editors** — all 5 (`zones`, `deal_templates`, `audience_segments`, `travel_moments`, `routes`) built under `web/src/app/(app)/config/`; edit + soft-disable; QA'd (code-review high + security-review + Playwright). They double as the tuning cockpit.
- ✅ **Engine tuning** — `skrendam analyze` + tiered queue (great/maybe) + the C5 fix; tuned from real data (`docs/research/2026-06-03-tuning-analysis.md`).
- ⏳ **AI suggestions / drafts** placeholder page (Spec §10) — still deferred.
- ⏳ **Public site + newsletter** (Spec 2) — still deferred; the admin writes clean `published_deals` for it. **See §6 for locked Spec 2 design inputs (JFC research).**

**Verification gaps:**
- **Recheck / run-scan via the queue** — `scan_requests` enqueue + the Python worker poll loop are built + unit-tested + verified manually, but NOT in the automated Playwright journey (needs the live `fli` worker). Add an E2E with a fake-backend worker toggle.

**Findings / tech-debt from the build:**
- **Round-trip calendar fix** — `live_backend.search_calendar` built a 1-segment round-trip `DateSearchFilters` (pydantic ValidationError → tripped breaker → 0 candidates). FIXED via `_build_date_filters` (adds the return leg). The per-trip-type calibration note (§2) still applies.
- **`.env` `$`-escaping** — bcrypt hashes (`$2b$…`) must escape `$` as `\$` or `dotenv-expand` silently blanks them (caused a login failure). Root-caused + fixed; documented in `web/.env.example`.
- **`next-auth` pinned exactly** (`5.0.0-beta.31`) — v5 is beta-only; prevents drift. Stack verified current; **`next@16.2.7` includes the May-2026 CVE batch** + CVE-2025-29927.
- **`npm audit` dev-only moderates** — `esbuild` SSRF via `drizzle-kit`'s deprecated `@esbuild-kit/*`; `postcss` XSS bundled by `next`. Build-time only, not exploitable here, no clean fix (npm auto-fix = absurd downgrades). Revisit on transitive bumps.
- **Layover airports missing from `fli.models.Airport`** (`ZWS`, `AGY`, …) — `fli/search/_decoders.py:334` logs a benign warning decoding real itineraries; cosmetic/upstream.
- **DB defaults for Next.js writes** — `scan_requests` got `server_default`s (status/requested_by/created_at) so Drizzle inserts don't violate NOT NULL. `published_deals`/`content_drafts` lack them; the Server Actions supply `published_at`/`tier`/`created_at` explicitly — consider `server_default`s if other writers appear.
- **Worker queue is single-worker v1** — non-atomic claim (SELECT queued → UPDATE running); a crash leaves a row stuck `running`. Use `SELECT … FOR UPDATE SKIP LOCKED` + a stuck-row requeue before multi-worker.
- **`skrendam/**` not in ruff `include`** (only `fli/**`, `tests/**`, `examples/**`, `scripts/**`) — engine escapes ruff; consider adding (will surface pre-existing style issues).
- **`datetime.utcnow()` deprecation** — `models._now()` + engine use it (removed in 3.14; handoff pins Python ≤3.13). Migrate to `datetime.now(UTC)` engine-wide (`worker.py` already uses a tz-safe `_utcnow`).

## 6. Spec 2 (Yip homepage / public site) — locked design inputs

_Added 2026-06-03 from founder research on Jack's Flight Club. Full notes:
`docs/research/2026-06-03-jfc-competitive-notes.md`. These are **inputs to the Spec 2
brainstorm**, not a build spec._

JFC validates Yip's model (curated, not search; scan + human verify; info, not booking). Three
delivery-layer lessons to design in from day one:
1. **Data-driven "expected availability window"** — surface a credible "act by ~X / still
   live" signal, *estimated* from `price_log` history + the `scan_requests` recheck cadence
   (not a blunt `valid_until` TTL). The fields (`valid_until` / `last_seen_at`) already exist.
2. **Tiered / segmented release** — access-timing logic (who sees a deal, when), built on the
   existing `tier` (great/maybe) + `audience_segments`. Likely a `publish_at`-per-tier schedule.
3. **Speed = the premium product** — if Yip charges, notification speed is the spine; model
   publish as a schedule across tiers/channels from the start, not a single instant publish.

Inputs 1 + 2 are likely the **first `published_deals` schema additions since milestone 2** (a
release schedule; possibly an availability-estimate field) — design them deliberately.
