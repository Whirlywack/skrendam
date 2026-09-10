# WP7 — `home` persona: reverse diaspora cohort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lithuanians abroad get „Grįžtu namo" finds: the scanner watches ten verified reverse routes (UK/Ireland/Nordics → VNO/KUN) inside the Christmas, Easter and summer home windows, subscribers can pick the `home` moment, and the desk/site handle abroad origins.

**Architecture:** Seed-only where possible (routes, a new zone, three fixed-window templates), no schema change. A dedicated zone `HOME_VFR` keeps the reverse routes out of the two zone-filtered templates that would otherwise triple the call cost. `home-easter` and `home-summer` ship disabled and are switched on by SQL (2027-01-07 / 2027-03-01); only `home-xmas` scans at launch.

**Tech Stack:** Python seeds + pytest (`skrendam/`), one string in `site/`, one label map in `web/`.

**Spec:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` §4 WP7, §10; parent plan §F WP7. Verified facts (routes with public evidence, cost arithmetic, tests to widen): `.superpowers/sdd/2026-09-10-demand-layer-implementation-plan/wp7-research.md`.

## Global Constraints

- Branch `feat/wp7-home-persona` from `main` after WP6 merges (or from the WP6 branch head if the founder wants it sooner — it touches disjoint files). Worktree `.claude/worktrees/wp7-home`.
- **Never probe Google Flights / fli interactively.** All schedule facts come from the research report; do not "verify" by scanning.
- Seeds are insert-only (`seeds._get_or_create`); the live DB gets the new rows on the next `seed_all` (the scan runs it — confirm in `skrendam/cli.py`/`orchestrator.py` before relying on it; otherwise `uv run skrendam seed`). Value changes on existing rows go in `scripts/YYYY-MM-DD_*.sql`.
- `scan_runs.api_calls` must stay inside the healthy envelope (~900/day, 0×429): ten routes × three windows ≈ +40–60 calls/day only if the routes match **no other template** — hence zone `HOME_VFR`, referenced by no zone-filtered template. Never add scan passes.
- Routes to seed (all with a public source in the research; three spec candidates are NOT operating and are dropped: OSL→KUN, BGO→KUN, MAN→KUN): `STN→KUN, STN→VNO, LTN→KUN, LTN→VNO, DUB→KUN, DUB→VNO, OSL→VNO, CPH→KUN, BGO→VNO, LPL→KUN` — all `core=True`.
- Copy: `prefHome = „Grįžtu namo iš užsienio"` (spec §7 verbatim); template names/labels in LT, honest; never „skenuoti".
- Tier thresholds, zones' price gates, scan cadence unchanged. `personas.json` already maps `home`/`vfr` → `["home"]` — do not edit it (drift test).
- Each commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_018PDTEbaxZkCdkN6PbHUSA9`.
- Gates: `uv run pytest tests/skrendam -q`; ruff check + format; `cd site && npx tsc --noEmit && npx vitest run`; `cd web && npx tsc --noEmit && npx vitest run`.

---

### Task 1: Zone `HOME_VFR`, ten reverse routes, tests widened

**Files:**
- Modify: `skrendam/seeds.py` (`ZONES` ~:54-65, `ROUTES` ~:79-220)
- Test: `tests/skrendam/test_seeds.py` (`test_route_list_size_and_validity` ~:108-119, `test_core_composition_feeds_every_enabled_template` ~:122-132), `tests/skrendam/test_shared_data.py` (unchanged unless it fails)

**Interfaces (produces):** zone tuple `("HOME_VFR", "short", 50, 25, 25)`; ten route tuples `(origin, "VNO"|"KUN", "HOME_VFR", True)` appended under a comment `# WP7 — reverse diaspora routes (origin abroad → home); zone HOME_VFR keeps them out of zone-filtered templates. Verified 2026-09-10, see docs/plans/2026-09-10-wp7-home-persona-plan.md`.

- [ ] **Step 1: Failing tests.** In `test_seeds.py`: replace the origin assertion with an allowlist `LT_ORIGINS = {"VNO","KUN","RIX"}`, `HOME_ORIGINS = {"STN","LTN","DUB","OSL","CPH","BGO","LPL"}`; assert every route origin ∈ `LT_ORIGINS | HOME_ORIGINS`, and every `HOME_VFR` route has origin ∈ `HOME_ORIGINS` and destination ∈ {"VNO","KUN"}; add `test_home_vfr_routes_are_exactly_the_verified_ten` asserting the set of `(o, d)` for zone `HOME_VFR` equals the ten pairs above; widen `26 <= len(core) <= 34` → `26 <= len(core) <= 40`; add `test_no_zone_filtered_template_references_home_vfr`: for every template dict in seeds with `included_zones`, `"HOME_VFR" not in included_zones`.
- [ ] **Step 2: Run** → FAIL (zone/routes absent).
- [ ] **Step 3: Implement** the zone and routes. `ROUTES` size becomes 169 (inside 150–175).
- [ ] **Step 4: Run** pytest + ruff → PASS (including `test_shared_data.py::test_every_seeded_airport_has_a_city` — all seven origins exist in `airports.json`).
- [ ] **Step 5: Commit** `feat(seeds): HOME_VFR zone + ten verified reverse diaspora routes`.

---

### Task 2: Templates `home-xmas`, `home-easter`, `home-summer` (+ enable-easter / enable-summer SQL)

**Files:**
- Modify: `skrendam/seeds.py` (templates list; model on `family-xmas-sun` ~:432-453 for fixed windows and `vfr-watch` ~:581-598 for audience/moment/tag)
- Create: `scripts/2027-01-07_enable_home_easter.sql`, `scripts/2027-03-01_enable_home_summer.sql`
- Test: `tests/skrendam/test_seeds.py` (fixed-window and coverage assertions), `tests/skrendam/test_resolver.py` if it exists (spec count for a HOME_VFR route)

**Interfaces (produces):** three templates:
| slug | name | fixed window (from `PEAK_WINDOWS` `home-*`, seeds.py:50-52) | enabled |
|---|---|---|---|
| `home-xmas` | „Kalėdoms namo" | 2026-12-18 → 2027-01-06 (out Dec 18–23; the window's return range Jan 2–6 is enforced by `date_fit`, the template window spans both) | True |
| `home-easter` | „Velykoms namo" | 2027-03-25 → 2027-04-05 | **False** (`scripts/2027-01-07_enable_home_easter.sql` flips it; fix round 1 headroom ruling) |
| `home-summer` | „Vasarai namo" | 2027-06-20 → 2027-07-05 | **False** (SQL flips it in March) |
Common fields: `audience="vfr"`, `moment="vfr_visit"`, `trip_type="roundtrip"`, `newsletter_tag="home"`, `included_zones=["HOME_VFR"]`, `included_destinations=["VNO","KUN"]`, `min_departure_dates` unset, `priority=100`, `date_window_type="fixed"`, `content_angle` LT one-liners („Namo Kalėdoms — bilietas iš Londono/Dublino už …" style is for headline patterns; keep `suggested_headline_template` unset so the brand-voice fallback runs), `family_friendly_times_only=False`, duration bounds matching the window (e.g. xmas `min_stay_days=7, max_stay_days=19`; easter 3–11; summer 5–15 — check the existing field names on `family-xmas-sun` and reuse them exactly).

- [ ] **Step 1: Failing tests.** `test_home_templates_fixed_windows_match_peak_windows`: for each slug, `fixed_start_date/fixed_end_date` equal the corresponding `PEAK_WINDOWS` row's `start`/`return_end or end`; `home-summer` has `enabled=False`; all three carry `included_zones=["HOME_VFR"]` and `newsletter_tag="home"`. Extend `test_core_composition_feeds_every_enabled_template` expectations (the two enabled home templates must get ≥1 core spec — they will, via the ten core routes).
- [ ] **Step 2–4:** red → implement → green. Write the SQL: `UPDATE deal_templates SET enabled = true WHERE slug = 'home-summer';` with a header comment „run 2027-03-01; adds ~10 specs/day".
- [ ] **Step 5: Commit** `feat(seeds): home-xmas / home-easter / home-summer templates (summer disabled until March)`.

---

### Task 3: Site `home` moment + desk origin labels

**Files:**
- Modify: `site/src/lib/subscribe-prefs.ts` (`PREF_MOMENTS` ~:31-37: append `{ code: 'home', label: 'Grįžtu namo iš užsienio' }`), `site/src/lib/subscribe.test.ts` (assert `MOMENT_CODES` includes `'home'`)
- Modify: `web/src/lib/airports.ts` only if `city()` lacks any of the seven codes (research says `airports.json` has them all — verify, then no change), `web/src/components/QueueBoard.tsx` origin tab label fallback: if `origins.find(...)?.label` is undefined show the code (guard only).
- Docs: `docs/PROJECT.md` §taxonomy/§coverage: add the `home` moment, the `HOME_VFR` zone, the March enable chore next to the yearly June school-date chore.

- [ ] Tests, commit `feat(site,desk): home moment preference; abroad-origin tabs; PROJECT.md`.

---

### Task 4: Apply and verify (controller + founder)

- [ ] Merge; confirm the next scan's `seed_all` inserted 1 zone, 10 routes, 3 templates (SQL count) and `scan_runs.api_calls` on the first full run ≤ ~970 with `0×429`; if over, disable `home-easter` until February (SQL) rather than adding passes.
- [ ] Desk: Review page shows STN/LTN/DUB/OSL/CPH/BGO/LPL tabs with labels; Coverage tab lists the three templates with priority 100.

## Acceptance (spec §4 WP7)
`home` in `PREF_MOMENTS`; ten reverse routes core; three templates with fixed windows; `api_calls` inside the envelope; desk works with abroad origins.
