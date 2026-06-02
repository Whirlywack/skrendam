# Out-of-scope register — Skrendam

Things deliberately deferred during the Plan 1 (deal engine) build + QA gauntlet. "Remembered and marked" so nothing is silently lost. Each item notes *why* it's deferred and *when/where* it should be picked up.

_Last updated: 2026-06-02, after the QA pass on the deal engine._

---

## 1. Browser end-to-end journey (Playwright) — the connected flow

**Status: deferred — blocked on Plan 2 (no wired UI yet).**

Plan 1 is the **headless Python engine**. The design-system UI kits (`.claude/skills/yip-design-system/ui_kits/curator` and `…/website`) are **static React demos with mock `data.js`** — not connected to the engine/DB.

- ✅ **Done now:** Playwright smoke of both static kits — they render and basic interactions work, no real console errors (screenshots: `qa-curator-deal-desk.png`, `qa-website-deal-detail.png`).
- ⏳ **Deferred to Plan 2:** the *real* beginning-to-end browser journey — curator logs in → sees **real candidates from the DB** → rechecks → approves → writes a `published_deal` → public site renders it → newsletter signup. This needs the Next.js curator admin + public site wired to Postgres (Plan 2 / Spec 2). Build the Playwright E2E for this flow when that app exists.

## 2. Engine follow-ups surfaced by review (non-blocking)

- **Per-trip-type calibration (review C5):** `calibrate.py` scans **one-way** only, but `zone.threshold_price_eur` is used as the absolute price ceiling for **round-trip** templates too → round-trip fares (naturally higher) can only pass via discount. Calibrate per trip-type, or scope the zone ceiling to one-way. **Tie this to the live-tuning dry-run.**
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
