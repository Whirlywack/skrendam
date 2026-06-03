# Spec — Engine tuning (tiered) + curator config editors (Plan 2, milestone 2)

_Date: 2026-06-03. Builds on the merged Plan 2 curator admin (`web/`) + the deal engine (`skrendam/`). Approved via brainstorming on 2026-06-03._

## 1. Summary

Two intertwined goals on the existing, real-data-wired curator admin:

- **Tune the engine** so the candidate queue is trustworthy (today's candidates pass *seeded-estimate* thresholds, not validated ones), surfaced as **two tiers — "great" + "maybe"**.
- **Finish the admin** with the deferred **config-CRUD editors** for all five engine config tables — which double as the UI to tune the per-template/zone knobs.

The two reinforce each other: the editors are the tuning cockpit; the analysis tells us what to set. **No schema migration is required** (tiers derive from the stored `match_score`; the calibrate fix is logic-only; soft-disable uses existing `enabled` flags).

## 2. Locked decisions

- **Queue selectivity:** tiered (great + maybe), not a single hard cutoff.
- **Editor scope:** all 5 config tables; edit + create; "remove" = **soft-disable** (no hard deletes).
- **Approach 1** (analyze → fix calibrate → tier → build editors → iterate). Global matching constants stay in code (tuned via the analysis); per-template/zone knobs are UI-tunable.

## 3. Workstream A — Tune the engine

### A1. Data-analysis pass (new, read-only)
A `skrendam analyze` CLI command + `skrendam/analyze.py` that profiles the real DB and prints a report (optionally also a `docs/research/2026-06-03-tuning-analysis.md` note):
- discount-% distribution + percentiles across candidates / `price_log`
- candidate volume **per template** and **per zone** (flooding vs starved)
- baseline sanity per route+zone (`sample_size`, `median`, `decile`)
- **tier preview:** great vs maybe counts at trial `match_score` cutoffs, per template
- a light external benchmark note (how deal curators define tiers) as a sanity rail — *not* the primary input

This report sets the threshold values used in A2/A3 and the per-template/zone editor values. Pure aggregation is unit-testable on in-memory SQLite.

### A2. Fix calibrate C5 — scope the zone ceiling to one-way
In `skrendam/scanning/matching.py`, the price-anomaly gate currently falls back to `zone.threshold_price_eur` for any template. That ceiling is calibrated from **one-way** scans, so round-trip templates pass on a too-low ceiling. Fix: **only apply the zone ceiling for one-way templates** (`tpl.trip_type == "oneway"`); round-trip templates must clear their own `tpl.max_price_eur` (set per-template in the editor) or a discount. No migration; `calibrate` (one-way scan) is now correctly a one-way ceiling.

### A3. Tier the queue — derived from `match_score`, no migration
- `matching.py`: keep the `SEND_THRESHOLD` floor (possibly lowered per the A1 analysis so the "maybe" tier survives). This stays a code constant, tuned from analysis.
- The **tier is derived downstream** from the already-stored `match_score`: add a `tier: "great" | "maybe"` to `CandidateView` in `web/src/lib/mappers.ts`, computed against a `GREAT_THRESHOLD` constant in a small `web/src/lib/tiers.ts` (e.g. score ≥ 80 → great), so no engine change or migration is needed to tier.
- **Queue UI** (`QueueBoard` / `Queue`): lead with **great** (prominent), **maybe** in a secondary section or behind a toggle, with a tier badge. The dashboard's existing `score ≥ 80` count already aligns with "great".

## 4. Workstream B — The 5 config editors (edit + soft-disable)

### Architecture
A **Config** area in the admin (the sidebar's currently-disabled Templates/Audience items become real, plus Moments / Routes / Zones). Each entity:
- a **server-component list page** (Drizzle read) under `web/src/app/(app)/config/<entity>/`
- a **client form** component
- **Server Actions** (`upsert<Entity>`, `toggle<Entity>Enabled` where applicable) — same patterns as the publish actions: `requireAdmin()` guard, input validation (numeric/enum), `try/catch` + toast, `revalidatePath`.

### Soft-disable (avoids a migration)
- `deal_templates` + `routes` have an `enabled` column → **edit + soft-disable** (toggle `enabled`).
- `zones` / `audience_segments` / `travel_moments` have **no** `enabled` column → **edit + create only** (reference data referenced by templates/routes; "removing" means reassigning dependents). Adding `enabled` to these is a one-column migration if ever wanted — out of scope here.

### Editors
- **Deal templates** (complex) — framed editorially per Spec §10: *Who* (audience_segment) · *When* (travel_moment + date window: relative/seasonal/fixed) · *Where* (included origins/zones/destinations + excludes) · **What's cheap** (`max_price_eur`, `min_discount_pct`, `psychological_price_threshold_eur`, `min_abs_savings_eur`, `allow_smaller_discount_if_under_price` — the tuning knobs) · *Itinerary pain* (`max_stops`, `max_total_duration_minutes`, layover bounds, cabin, self-transfer, prefer_direct, family-friendly times) · *Content angle* (`suggested_headline_template`, `tiktok_hook_template`, content_angle, newsletter_section, publish_channel_default). Plus `enabled`, `priority`, `trip_type`, `newsletter_tag`, `public_label`.
- **Zones** — `threshold_price_eur`, `min_abs_savings_eur`, `min_discount_pct`, `haul_type` (tuning knobs).
- **Audience segments** — slug, name, description, default_itinerary_tolerance.
- **Travel moments** — slug, name, description, moment_type, default_content_angle.
- **Routes / destinations** — origin, destination, zone, cabin, `enabled` (soft-disable).

## 5. Data model impact

**None — no Alembic migration.** Tiers derive from `match_score`; the calibrate fix is matching logic only; soft-disable uses existing `enabled` flags; the reference tables are edited in place. (The web app continues to read the schema via the committed `drizzle-kit pull` output; no re-introspection needed unless the engine schema changes, which it does not here.)

## 6. Data flow

Editor → Server Action → Drizzle upsert into the config table → the **next** engine scan/recheck reads the updated config. Config changes are not retroactive; they affect subsequent scans. The analysis (A1) is read-only; calibrate (A2) writes `zones.threshold_price_eur`.

## 7. Error handling

- Server Actions: `requireAdmin()`, validate inputs (numeric ranges, enum membership for `trip_type`/`moment_type`/`haul_type`/cabin), `try/catch` with error toasts (the pattern already in the client components), `revalidatePath` on success.
- No hard deletes (soft-disable) → no FK orphaning of candidates/matches.
- The analysis command degrades gracefully on empty/partial data (e.g. "no candidates yet").

## 8. Testing

- **A1:** unit test the pure aggregation in `analyze.py` (rows in → expected summary) on in-memory SQLite.
- **A2:** matching unit test — a round-trip template with no `max_price_eur` does **not** pass on the zone ceiling alone; a one-way template still does.
- **A3:** web unit test for the mapper's tier derivation (great vs maybe at the cutoff boundary).
- **B:** Server-Action tests for upsert + toggle-enabled (where applicable); a Playwright test that edits a template's `min_discount_pct` and sees it persisted.
- Engine suite + `mypy` stay green; web `tsc`/`eslint`/vitest stay green.

## 9. Build sequence (milestones)

1. **A1** — `skrendam analyze` + the analysis note (informs every threshold).
2. **A2 + A3** — calibrate one-way-ceiling fix + tiering (matching constant + mapper/UI tier).
3. **B** — the 5 config editors (deal_templates + zones first — the tuning ones — then audiences/moments/routes).
4. **Tune + iterate** — set per-template/zone values via the editors using the A1 findings; adjust the global constants in code; gut-check the tiered queue; repeat.

## 10. Out of scope / deferred

- Promoting the global matching constants (`WEIGHTS`, `SEND_THRESHOLD`, `GREAT_THRESHOLD`) to a UI-editable settings table (Approach 2) — YAGNI; they change rarely.
- Adding `enabled` to zones/audiences/moments for soft-disable on those tables.
- The remaining v1 itinerary-gate limitations (per-leg times/layovers — §2 of the out-of-scope register).
- AI-suggestions placeholder; Spec 2 public site; R1 affiliate data source. (Tracked in `docs/superpowers/out-of-scope.md`.)
