# Demand Layer & Launch — Implementation Plan (worktrees)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the demand layer (`score_v2`, archetypes, time gates, peak windows, family Christmas template) into the scanner first, then the desk, email streams, launch hygiene, and the `home` persona — one worktree and one PR per work package, in the spec's order WP2 → WP3 → WP6 → WP0 → WP7 → WP8 (WP0 runs in parallel with WP2).

**Architecture:** WP2 adds a pure `skrendam/scanning/scoring/demand.py` layer called from `orchestrator._persist_fare()` after `pick_headline()`; it demotes commodity fares and promotes date/rare/destination deals into three new columns on `candidate_template_matches` plus a new `peak_windows` table. Everything downstream (desk Today, letters, site exposure) reads those persisted columns after a drizzle re-pull. No new scorer is registered; scorers only add matches, this layer also demotes.

**Tech Stack:** Python 3.13 / SQLAlchemy 2 / Alembic (`skrendam/`, `uv`); Next.js + drizzle (`web/` desk — runs **locally on the founder's laptop**, like the scan; `site/` — Vercel; nothing on Railway); Neon Postgres project `yip`, **`dev` branch** is live; Resend (site already, web to add); pytest + vitest.

**Spec:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` (v3). Companions: `docs/plans/2026-09-04-deal-thesis.md`, `docs/PROJECT.md`.

## Global Constraints

- Feature work in git worktrees off `main`; merges gated by `gh run watch --exit-status` (never `gh pr checks --watch`).
- Alembic migrations for schema (`alembic/versions/`, chain from `0011_brand_voice_headlines`); `tests/skrendam/test_migration.py::test_autogenerate_reports_no_diff` runs `alembic upgrade head` + `alembic check` on SQLite — every model change needs a matching migration or CI fails.
- Drizzle schemas in `web/src/db/generated` and `site/src/db/generated` are **introspected** (`npx drizzle-kit pull` / `npm run db:pull`), never hand-edited.
- No site layout/page/copy/design work (founder decision 1). Desk UI changes need no mockups.
- Copy rules: show the catch; no invented social proof; never the word "scan"/„skenuoti" in public copy (use *peržiūrim*); any „usually/įprastai/was" price obeys `WAS_PRICE_MIN_DROP_PCT = 30` (`web/src/lib/format.ts`, `site/src/lib/format-rules.ts`) / `WAS_PRICE_MIN_DISCOUNT = 0.30` (`skrendam/scanning/content.py`).
- Google load: nothing adds searches except the WP7 cohort; never probe interactively; never rescan a healthy completed run.
- Seeds are insert-only (`seeds._get_or_create`): new rows via `seeds.py`; value changes via `scripts/YYYY-MM-DD_*.sql` on the live DB.
- Tier thresholds live only in `skrendam/scanning/scoring/tiering.py` (`GREAT = 88`, `RARE = 94`); downstream reads results.
- Constants (spec §6) verbatim: `COMMODITY_FLOOR_SHARE = 0.20`, `FLOOR_TOLERANCE = 1.05`, `FLOOR_LOOKBACK_DAYS = 90`, `FLOOR_MIN_DAYS = 14`, `COMMODITY_CAP = 40`, `DATE_FIT_PEAK = 1.25`, `DATE_FIT_WEEKEND = 1.10`, `DEMAND_W = {"A": 1.00, "B": 0.85, "C": 0.70}`, `ABS_SAVING_FLOOR_EUR = 60`, `ABS_SAVING_FLOOR_CONNECTING_EUR = 150`, `MIN_DISCOUNT_PCT = 40`, `DATE_DEAL_MAX_RATIO = 0.60`, `WINDOW_TYPICAL_MIN_POINTS = 10`, `RARE_DISCOUNT_PCT = 60`, `TODAY_N = 10`, `FREE_LETTER_CADENCE_DAYS = 10`, `FREE_LETTER_FRESH = 2`, `FREE_LETTER_MISSED = 3`.

---

## A. What the research verified (read before trusting the spec)

Every claim below was checked in the code on 2026-09-10. ✅ = spec is right; ⚠ = spec is right but incomplete; ❌ = spec is wrong or impossible as written — the plan adapts.

| Spec claim | Reality | Effect on plan |
|---|---|---|
| Hook point `_persist_fare()` after `pick_headline()`, headline + `hist_series` in scope | ✅ `skrendam/scanning/orchestrator.py`: `matched = [(tpl, headline, scores)]`, `hist_series = history.for_route(route.id, spec.trip_type)`; per match → `repo.upsert_match(...)` in `skrendam/db/repositories.py` (writes headline fields on insert **and** update) | Wire demand there; extend `upsert_match` kwargs |
| ⚠ `hist_series` is per route/trip (founder-approved fix 2026-09-10) | `DbPriceHistory.for_route(route_id, trip_type, duration_days=None)` **supports duration partitioning but the orchestrator never passes it** → round-trip series blend 3-day and 14-day totals | Demand layer fetches its own `history.for_route(route.id, spec.trip_type, spec.duration_days)` (cached per key; no extra DB cost beyond one query per route/duration) |
| Time-of-day fields exist but are consumed nowhere | ✅ zero references outside `models.py`/`seeds.py`; `earliest_departure_hour`/`latest_arrival_hour` are NULL in every seed; only `family_friendly_times_only=True` is set (family templates) | Gate needs **defaults** for family-friendly (spec says "departure ≥ 07:00"; no arrival number given → plan uses 23:00, see Decisions D3) |
| Times available from `fare.legs` | ✅ `live_backend.search_flights` serialises each leg as `{airline, flight_number, departure_airport, arrival_airport, departure_time (ISO), arrival_time (ISO)}` — ⚠ **flattened across both directions** with no direction marker; test fixtures use `legs=[]` or legs without times | "first departure / last arrival" = outbound departure / return arrival at home; missing times must be **permissive** (unknown ≠ fail) or every fixture and older snapshot breaks |
| Outlier exposes `possible_error_fare` | ✅ `outlier.py` signals `{robust_z, local_median, possible_error_fare}`; scorer names: `weighted, drop, error_fare, rarity, outlier` | rare archetype = `possible_error_fare` or a score with `scorer == "error_fare"` or `discount ≥ 60` |
| `RarityScorer.percentile()` | ⚠ it's `PriceHistorySeries.percentile()`; points are `HistoryPoint(scanned_at, travel_date, price, return_date)` | commodity_share/window_typical are pure functions over `series.points` |
| `tiering.py` single source of truth | ✅ `skrendam/scanning/scoring/tiering.py`: `to_score_100()`, `quality_tier()` | `score_v2` tier via `tiering.quality_tier` |
| `content.py` body always None | ✅ `build_content_draft(origin, destination, price, baseline, travel_date, template)`; `WAS_PRICE_MIN_DISCOUNT = 0.30` (Python name differs from TS) | WP3 extends it |
| `airports.json` sharing pattern | ✅ canonical `skrendam/airports.json`, copies in `web/src/lib/` and `site/src/lib/`, drift test `tests/skrendam/test_shared_data.py` parametrised by file name | `personas.json` + `demand_tiers.json` follow it exactly (add to the parametrize list) |
| Alembic | ✅ single head `0011_brand_voice_headlines`; env reads `SKRENDAM_DATABASE_URL` (`Settings`, env_prefix `SKRENDAM_`); `daily-scan.sh` derives it from `web/.env.local` `DATABASE_URL` | WP2 = `0012_demand_layer`, WP6 = `0013_email_streams` |
| Desk: "Resend from `web/`" | ❌ **`web/` is not deployed anywhere** — the desk AND the scan both run on the founder's laptop (`web/.env.local`, port 3000; launchd scan). Vercel hosts `site/` only. The `railway.toml`/`nixpacks.toml` in the repo are leftover upstream-fli MCP-server config — nothing of Yip's is hosted there (founder, 2026-09-10). `web` has no `resend` dependency | Sends are **curator-triggered server actions** in the desk (instant-on-publish inside `publishDeal`, issue "Send" button). A **Thursday 07:00 automatic** digest has no always-on host → Decision D1 |
| `lasted_hours = expired_at − published_at` | ❌ `published_deals` has `published_at` but **no `expired_at`** (only `valid_until`, `last_seen_at`, `unverified_since`) | WP6 migration adds `published_deals.expired_at`; `expireDeal` action + `_expire_published_past_date` set it |
| `subscribers.prefs` holds origins/moments | ✅ `site/src/lib/subscribe-prefs.ts` (`PREF_MOMENTS` codes `sun, city, family, weekend, last_minute`; `PREF_ORIGINS` incl. PLQ/WAW); `SUBSCRIBE_SOURCES` list; insert in `subscribe-action.ts` sets `email, source, earlyAlerts, confirmToken`; prefs saved later by `savePreferencesAction` | WP0.1 stores `prefs.utm`/`referred_by` at insert |
| Early-alerts checkbox on the free form | ✅ `site/src/components/SignupCard.tsx` (~L94) and `site/src/app/subscribe/page.tsx` (~L72); `/early-alerts` page posts hidden `early_alerts=on` | WP0.1 removes the two checkboxes; `/early-alerts` page handled in WP6.4 |
| Desk Today = `shortlist.ts` | ✅ `SHORTLIST = 20`, `shortlistIds(rows)` by best `score` per candidate; used by `QueueBoard.tsx` ("New today" scope); rows come from `queries.queueBase()` which selects `score0100`, `qualityTier`, drafts, template label; `getRouteOrigins()` builds city tabs from `routes.origin` (so WP7's abroad origins appear automatically) | WP3 adds `scoreV2/archetype/demandSignals` to `queueBase` + `CandidateView` |
| `deal_templates.priority` unused | ✅ int, default 0, in drizzle schema | One-off SQL + Coverage column |
| Reverse routes feasible without schema change | ✅ `routes(origin,destination)` generic; resolver honours `included_origins`; all 159 seeded routes originate VNO/KUN/RIX (only `KUN→RIX` crosses) | WP7 seeds ~10 abroad-origin rows |
| Tests | SQLite in-memory `session` fixture (`create_all`); `test_migration.py` also runs real alembic on SQLite; orchestrator tests use `FakeBackend` returning leg dicts without times | New tests follow these fixtures |

**Untouched/idle since 2026-08-28:** no WP2 work exists in any branch or worktree; latest handoff is `docs/handoffs/2026-08-28-v2-ship-session-close.md`.

## B. Worktree & PR strategy

One worktree = one branch = one PR per work package. Create every worktree **from the main checkout with an absolute path** (a relative path from inside another worktree nests it — happened on 2026-09-03):

```bash
cd /Users/superoptimised/Skrendam && git fetch origin
git worktree add "$PWD/.claude/worktrees/<name>" -b <branch> origin/main
```

| WP | Worktree | Branch | Touches | Depends on | Migration |
|---|---|---|---|---|---|
| WP2 | `wp2-demand` | `feat/wp2-demand-layer` | `skrendam/`, `alembic/`, `tests/skrendam/`, `scripts/`, JSON copies in `web/src/lib` + `site/src/lib` | — | `0012_demand_layer` |
| WP0 | `wp0-hygiene` | `feat/wp0-launch-hygiene` | `site/` only | — (0.4's demand fields wait for WP2's drizzle pull) | none |
| WP3 | `wp3-desk` | `feat/wp3-desk-today` | `web/`, `skrendam/scanning/content.py` (+tests) | WP2 merged + drizzle pulled | none (`issues` table comes with WP6; the issue page lands in WP6) |
| WP6 | `wp6-email` | `feat/wp6-email-streams` | `alembic/`, `web/`, `site/` | WP3 merged | `0013_email_streams` |
| WP7 | `wp7-home` | `feat/wp7-home-persona` | `skrendam/seeds.py`, `site/src/lib/subscribe-prefs.ts`, JSON copies, desk checks | WP3 merged | none |
| WP8 | `wp8-instrumentation` | `feat/wp8-instrumentation` | `web/` | WP6 merged | none |

Parallelism: **WP2 ∥ WP0** from day one. Everything else is sequential on `main`.

Per-worktree setup (node_modules and `.venv` are not shared):

```bash
# Python worktrees
cd "$WT" && uv sync --all-extras && uv run pytest tests/skrendam -q      # expect 188+ passed
# web / site worktrees
cd "$WT/web"  && npm ci --no-audit --no-fund && npx tsc --noEmit && npm run test
cd "$WT/site" && npm ci --no-audit --no-fund && npx tsc --noEmit && npx vitest run
```

**Migration protocol (per migration PR, before merge):**

```bash
# from the worktree, VPN OFF (ProtonVPN breaks Neon DNS — check: scutil --nc list | grep -i proton)
export SKRENDAM_DATABASE_URL="$(grep -E '^DATABASE_URL_UNPOOLED=' /Users/superoptimised/Skrendam/web/.env.local | cut -d= -f2- | tr -d '"')"
uv run alembic upgrade head                       # additive only → safe while the old scan code still runs
uv run skrendam seed                              # insert-only: new peak_windows rows / new templates
psql "$SKRENDAM_DATABASE_URL" -f scripts/<date>_<name>.sql   # value changes (e.g. launch priority)
(cd web  && DATABASE_URL_UNPOOLED="$SKRENDAM_DATABASE_URL" npx drizzle-kit pull)
(cd site && DATABASE_URL_UNPOOLED="$SKRENDAM_DATABASE_URL" npm run db:pull)
git add web/src/db/generated site/src/db/generated && git commit -m "chore(db): re-pull drizzle schemas after 00NN"
```

Merge gate for every PR: `gh pr create` → `gh run watch <run-id> --exit-status` → `gh pr merge --merge --delete-branch` (run from the main checkout, otherwise `gh` fails to switch branches). After merge: `git pull --ff-only` in the main checkout (the 06:00 scan runs from it), `git worktree remove`.

Hand-off per WP: dated note in `docs/handoffs/`, update `docs/PROJECT.md` §7 (spec §11).

## C. Decisions needed from the founder (defaults chosen so work can start)

- **D1 — Where scheduled sends run.** The desk has no always-on server (laptop only). Default: instant paid email fires inside the `publishDeal` server action (desk, local); digest and nurture are assembled on the desk's Issue page and sent by a **Send button** (Thursday morning is a calendar habit at launch). Automation later = a Vercel Cron route in `site/` sending a *saved, approved* issue. Alternative: run a Python sender under launchd (duplicates email templates in Python — not recommended).
- **D2 (founder-approved 2026-09-10) — `published_deals.expired_at`** (not in the spec's schema list) is added in `0013` so „Ką praleidai" can state how long a deal lasted. Backfill for already-expired rows: `COALESCE(valid_until, last_seen_at)`.
- **D3 — Family time defaults.** `family_friendly_times_only=True` with NULL hour columns means: departure ≥ **07:00**, home arrival before **23:00** (`FAMILY_EARLIEST_DEP_HOUR = 7`, `FAMILY_LATEST_ARR_HOUR = 23`). The spec fixes only the first number.
- **D4 — Legs are flattened.** "first departure / last arrival" = outbound departure and *return* arrival. Good enough for the family promise; per-direction gates would need a direction marker in the snapshot (not planned).
- **D5 — `home-xmas-2026` has two ranges** (out Dec 18–23, back Jan 2–6). `peak_windows` gets nullable `return_start_date/return_end_date` so `date_fit` can check the return leg against its own range.
- **D6 — `quality_tier` on matches is recomputed from `score_v2`** (spec WP2.8); `score_0_100` stays as the raw headline. Desk badges therefore reflect v2 automatically.

---

## D. WP2 — Demand layer in the scanner (detailed)

### Task 1: Worktree + baseline

**Files:** none (setup)

- [ ] **Step 1: Create the worktree from the main checkout**

```bash
cd /Users/superoptimised/Skrendam && git fetch origin
git worktree add "$PWD/.claude/worktrees/wp2-demand" -b feat/wp2-demand-layer origin/main
cd "$PWD/.claude/worktrees/wp2-demand" && uv sync --all-extras
```

- [ ] **Step 2: Confirm the baseline is green**

Run: `uv run pytest tests/skrendam -q`
Expected: all pass (188 passed, 2 skipped on 2026-09-04).

### Task 2: Time-of-day gates (the June bug)

**Files:**
- Modify: `skrendam/scanning/scoring/eligibility.py` (`itinerary_ok`)
- Test: `tests/skrendam/test_eligibility_time_gates.py` (new)

**Interfaces:**
- Produces: `leg_hours(fare) -> tuple[int | None, int | None]`, `times_ok(fare, tpl) -> bool`, constants `FAMILY_EARLIEST_DEP_HOUR = 7`, `FAMILY_LATEST_ARR_HOUR = 23`; `itinerary_ok` now calls `times_ok`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/skrendam/test_eligibility_time_gates.py
from skrendam.db import models
from skrendam.scanning.scoring.eligibility import itinerary_ok, leg_hours, times_ok
from skrendam.scanning.types import FareItinerary


def _fare(dep: str | None, arr: str | None) -> FareItinerary:
    legs = []
    if dep or arr:
        legs = [
            {"departure_time": dep, "arrival_time": "2026-10-30T09:10:00"},
            {"departure_time": "2026-11-06T18:00:00", "arrival_time": arr},
        ]
    return FareItinerary(price=99.0, currency="EUR", stops=0, duration_minutes=200, legs=legs)


def _tpl(**over) -> models.DealTemplate:
    return models.DealTemplate(slug="t", name="t", trip_type="roundtrip", **over)


def test_leg_hours_reads_first_departure_and_last_arrival():
    assert leg_hours(_fare("2026-10-30T05:50:00", "2026-11-06T23:40:00")) == (5, 23)


def test_leg_hours_is_none_without_times():
    assert leg_hours(_fare(None, None)) == (None, None)
    assert leg_hours(FareItinerary(99.0, "EUR", 0, 100, legs=[{"airline": {"code": "W6"}}])) == (None, None)


def test_family_friendly_rejects_0550_departure_and_2340_arrival():
    tpl = _tpl(family_friendly_times_only=True)
    assert not times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
    assert not times_ok(_fare("2026-10-30T09:00:00", "2026-11-06T23:40:00"), tpl)
    assert times_ok(_fare("2026-10-30T07:00:00", "2026-11-06T22:59:00"), tpl)


def test_explicit_hours_override_family_defaults():
    tpl = _tpl(family_friendly_times_only=True, earliest_departure_hour=5)
    assert times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
    tpl2 = _tpl(latest_arrival_hour=21)  # no family flag, explicit ceiling still applies
    assert not times_ok(_fare("2026-10-30T09:00:00", "2026-11-06T22:10:00"), tpl2)


def test_missing_times_are_permissive_and_non_family_templates_ignore_hours():
    assert times_ok(_fare(None, None), _tpl(family_friendly_times_only=True))
    assert times_ok(_fare("2026-10-30T05:50:00", "2026-11-06T23:40:00"), _tpl())


def test_itinerary_ok_applies_the_time_gate():
    tpl = _tpl(family_friendly_times_only=True, max_stops=1)
    assert not itinerary_ok(_fare("2026-10-30T05:50:00", "2026-11-06T15:00:00"), tpl)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_eligibility_time_gates.py -q`
Expected: FAIL — `ImportError: cannot import name 'leg_hours'`.

- [ ] **Step 3: Implement**

In `skrendam/scanning/scoring/eligibility.py` add after the imports:

```python
from datetime import datetime

# Family-friendly defaults (spec 2026-09-10 §2.2 "departure ≥ 07:00"; the arrival
# ceiling is the plan's D3 default). A template's explicit hour columns win.
FAMILY_EARLIEST_DEP_HOUR = 7
FAMILY_LATEST_ARR_HOUR = 23


def _hour(leg, key: str) -> int | None:
    value = leg.get(key) if isinstance(leg, dict) else None
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).hour
    except ValueError:
        return None


def leg_hours(fare: FareItinerary) -> tuple[int | None, int | None]:
    """(first departure hour, last arrival hour) from the snapshot's ISO leg times.

    Legs are flattened across directions (live_backend), so on a round trip the
    last arrival is the return leg landing at home. None when the snapshot has
    no times (older rows, test fixtures) — unknown must never fail a gate.
    """
    legs = fare.legs or []
    if not legs:
        return None, None
    return _hour(legs[0], "departure_time"), _hour(legs[-1], "arrival_time")


def times_ok(fare: FareItinerary, tpl) -> bool:
    """Time-of-day gate: seeded since June 2026, enforced since 2026-09 (spec WP2.1)."""
    earliest = tpl.earliest_departure_hour
    latest = tpl.latest_arrival_hour
    if tpl.family_friendly_times_only:
        earliest = FAMILY_EARLIEST_DEP_HOUR if earliest is None else earliest
        latest = FAMILY_LATEST_ARR_HOUR if latest is None else latest
    if earliest is None and latest is None:
        return True
    dep, arr = leg_hours(fare)
    if earliest is not None and dep is not None and dep < earliest:
        return False
    if latest is not None and arr is not None and arr >= latest:
        return False
    return True
```

and in `itinerary_ok`, before `return True`:

```python
    if not times_ok(fare, tpl):
        return False
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/skrendam/test_eligibility_time_gates.py tests/skrendam/test_scoring_weighted.py tests/skrendam/test_orchestrator.py -q`
Expected: PASS (existing fixtures have no times → permissive).

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/eligibility.py tests/skrendam/test_eligibility_time_gates.py
git commit -m "fix(scan): enforce family/time-of-day gates from fare legs (seeded since June, never read)"
```

### Task 3: Shared static resources — `personas.json`, `demand_tiers.json`

**Files:**
- Create: `skrendam/personas.json`, `skrendam/demand_tiers.json`
- Create (copies): `web/src/lib/personas.json`, `web/src/lib/demand_tiers.json`, `site/src/lib/personas.json`, `site/src/lib/demand_tiers.json`
- Modify: `tests/skrendam/test_shared_data.py` (parametrize list)
- Test: `tests/skrendam/test_demand_data.py` (new)

**Interfaces:**
- Produces: JSON shapes below; Python loaders live in Task 5 (`demand.load_personas()`, `demand.load_demand_tiers()`).

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_demand_data.py
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_personas_map_every_seeded_newsletter_tag():
    from skrendam.seeds import seed_all  # noqa: F401  (import guards the module path)
    personas = json.loads((ROOT / "skrendam" / "personas.json").read_text(encoding="utf-8"))
    seeds = (ROOT / "skrendam" / "seeds.py").read_text(encoding="utf-8")
    import re
    tags = set(re.findall(r'newsletter_tag="([a-z_]+)"', seeds))
    assert tags <= set(personas), f"newsletter tags without persona mapping: {tags - set(personas)}"
    codes = {c for v in personas.values() for c in v}
    assert codes <= {"sun", "city", "family", "weekend", "last_minute", "home"}


def test_demand_tiers_shape():
    tiers = json.loads((ROOT / "skrendam" / "demand_tiers.json").read_text(encoding="utf-8"))
    assert tiers["weights"] == {"A": 1.0, "B": 0.85, "C": 0.7}
    assert not set(tiers["A"]) & set(tiers["B"]), "an airport can't be in two tiers"
    assert {"STN", "DUB", "OSL"} <= set(tiers["vfr"])
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/skrendam/test_demand_data.py -q` — Expected: FAIL (`FileNotFoundError`).

- [ ] **Step 3: Create the resources**

`skrendam/personas.json` (spec §2.2; `newsletter_tag → pref codes`):

```json
{
  "family_sun": ["family"],
  "plan_summer": ["family"],
  "last_minute": ["weekend", "last_minute"],
  "xmas": ["weekend", "city"],
  "sept_sun": ["weekend"],
  "vfr": ["home"],
  "home": ["home"],
  "winter_sun": ["sun"],
  "last_warm": ["sun"],
  "long_haul": ["city"],
  "ski": ["city"]
}
```

`skrendam/demand_tiers.json` (spec §10):

```json
{
  "weights": {"A": 1.0, "B": 0.85, "C": 0.7},
  "A": ["CDG","BVA","FCO","CIA","BGY","MXP","BUD","AMS","IST","STN","LTN","LGW","PRG","TFS","LPA","ALC","HER","CHQ","FNC","LCA","PFO","AGP","PMI","BCN"],
  "B": ["BER","VIE","LIS","DUB","NCE","OSL","TIA","HRG","SSH","DXB","BKK","TGD","BRI","NAP","ATH","OPO","VLC","KRK","WAW","CPH","MLA","AYT"],
  "vfr": ["STN","LTN","LGW","DUB","OSL","BGO","CPH","MAN","EDI","BRS","LPL","ARN","HHN","EIN","SNN"]
}
```

Copy to both apps and extend the drift test:

```bash
cp skrendam/personas.json skrendam/demand_tiers.json web/src/lib/
cp skrendam/personas.json skrendam/demand_tiers.json site/src/lib/
```

In `tests/skrendam/test_shared_data.py` change the parametrize to
`@pytest.mark.parametrize("name", ["airports.json", "airlines.json", "personas.json", "demand_tiers.json"])`.

- [ ] **Step 4: Run tests** — `uv run pytest tests/skrendam/test_demand_data.py tests/skrendam/test_shared_data.py -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add skrendam/personas.json skrendam/demand_tiers.json web/src/lib/personas.json web/src/lib/demand_tiers.json site/src/lib/personas.json site/src/lib/demand_tiers.json tests/skrendam/test_shared_data.py tests/skrendam/test_demand_data.py
git commit -m "feat(demand): shared personas.json + demand_tiers.json (canonical in skrendam/, copies in web/site)"
```

### Task 4: `peak_windows` table + match columns — model, migration `0012`, seed

**Files:**
- Modify: `skrendam/db/models.py` (new `PeakWindow`; 3 columns on `CandidateTemplateMatch`)
- Create: `alembic/versions/0012_demand_layer.py`
- Modify: `skrendam/seeds.py` (`PEAK_WINDOWS`, `LT_XMAS_BREAK`, seeding loop)
- Test: `tests/skrendam/test_seeds.py`, `tests/skrendam/test_migration.py` (existing autogenerate check)

**Interfaces:**
- Produces: `models.PeakWindow(slug, name, kind, start_date, end_date, return_start_date?, return_end_date?, pref_codes: list[str], source_url?, notes?)`; `CandidateTemplateMatch.score_v2: int|None`, `.archetype: str|None`, `.demand_signals: dict|None`; `seeds.PEAK_WINDOWS`, `seeds.LT_XMAS_BREAK`.

- [ ] **Step 1: Write the failing tests** (append to `tests/skrendam/test_seeds.py`)

```python
def test_peak_windows_seeded_from_spec_section_10(session):
    seed_all(session)
    rows = {w.slug: w for w in session.query(models.PeakWindow).all()}
    assert len(rows) == 13
    assert rows["kaledos-2026"].start_date == date(2026, 12, 21)
    assert rows["kaledos-2026"].end_date == date(2027, 1, 3)
    assert set(rows["kaledos-2026"].pref_codes) == {"family", "home"}
    assert rows["home-xmas-2026"].return_start_date == date(2027, 1, 2)
    assert rows["home-xmas-2026"].return_end_date == date(2027, 1, 6)
    assert {w.kind for w in rows.values()} == {"school_break", "public_holiday", "long_weekend", "custom"}
    seed_all(session)  # insert-only
    assert session.query(models.PeakWindow).count() == 13
```

- [ ] **Step 2: Run** — `uv run pytest tests/skrendam/test_seeds.py::test_peak_windows_seeded_from_spec_section_10 -q` → FAIL (`AttributeError: PeakWindow`).

- [ ] **Step 3: Model + migration + seed**

`skrendam/db/models.py` — add after `TravelMoment`:

```python
class PeakWindow(Base):
    """A normally-expensive calendar window (school break, public holiday, long
    weekend, custom). The date archetype compares a fare with history from the
    SAME window, not with the month's median (spec 2026-09-10 WP2.3/2.5)."""

    __tablename__ = "peak_windows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)  # school_break|public_holiday|long_weekend|custom
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    # Optional separate range for the return leg (e.g. home-xmas: out Dec 18-23, back Jan 2-6).
    return_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    return_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pref_codes: Mapped[list] = mapped_column(JSON)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
```

and on `CandidateTemplateMatch` after `primary_scorer`:

```python
    # Demand layer (spec 2026-09-10 WP2.9). score_0_100 stays the raw headline.
    score_v2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    archetype: Mapped[str | None] = mapped_column(String, nullable=True)  # date|rare|destination|None
    demand_signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

`alembic/versions/0012_demand_layer.py`:

```python
"""demand layer: peak_windows + match score_v2/archetype/demand_signals (spec 2026-09-10 WP2)."""

import sqlalchemy as sa
from alembic import op

revision = "0012_demand_layer"
down_revision = "0011_brand_voice_headlines"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "peak_windows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("return_start_date", sa.Date(), nullable=True),
        sa.Column("return_end_date", sa.Date(), nullable=True),
        sa.Column("pref_codes", sa.JSON(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug"),
    )
    with op.batch_alter_table("candidate_template_matches") as b:
        b.add_column(sa.Column("score_v2", sa.Integer(), nullable=True))
        b.add_column(sa.Column("archetype", sa.String(), nullable=True))
        b.add_column(sa.Column("demand_signals", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("candidate_template_matches") as b:
        b.drop_column("demand_signals")
        b.drop_column("archetype")
        b.drop_column("score_v2")
    op.drop_table("peak_windows")
```

`skrendam/seeds.py` — beside the other break constants:

```python
LT_XMAS_BREAK = (date(2026, 12, 18), date(2026, 12, 28))  # break Dec 21 – Jan 3 (start moved Dec 23→21, ŠMSM 2026-07-30)

# Peak calendar windows — spec 2026-09-10 §10. Travel dates, not departures.
# Refresh with the school calendar each June (like LT_*_BREAK).
SMSM = "https://smsm.lrv.lt/lt/veiklos-sritys-1/smm-svietimas/20252026-m-m-ir-20262027-m-m-mokiniu-atostogos/"
PEAK_WINDOWS = [
    # slug, name, kind, start, end, pref_codes, return_start, return_end, source, notes
    ("rudens-2026", "Rudens atostogos 2026", "school_break", date(2026, 10, 31), date(2026, 11, 8), ["family", "weekend"], None, None, SMSM, "Nov 1–2 public holidays inside"),
    ("kaledos-2026", "Kalėdų atostogos 2026", "school_break", date(2026, 12, 21), date(2027, 1, 3), ["family", "home"], None, None, SMSM, None),
    ("ziemos-2027", "Žiemos atostogos 2027", "school_break", date(2027, 2, 15), date(2027, 2, 21), ["family", "weekend"], None, None, SMSM, "Feb 16 inside"),
    ("pavasario-2027", "Pavasario atostogos 2027 (1–10 kl.)", "school_break", date(2027, 3, 22), date(2027, 3, 29), ["family", "home"], None, None, SMSM, "Easter Mar 28"),
    ("pavasario-gimn-2027", "Pavasario atostogos 2027 (gimnazija)", "school_break", date(2027, 3, 29), date(2027, 4, 4), ["family"], None, None, SMSM, None),
    ("vasara-2027", "Vasaros atostogos 2027", "school_break", date(2027, 6, 5), date(2027, 8, 31), ["family"], None, None, SMSM, "school-specific start"),
    ("kovo-11-2027", "Kovo 11-oji 2027", "long_weekend", date(2027, 3, 11), date(2027, 3, 14), ["weekend"], None, None, None, None),
    ("jonines-2027", "Joninės 2027", "long_weekend", date(2027, 6, 24), date(2027, 6, 27), ["weekend"], None, None, None, None),
    ("liepos-6-2027", "Liepos 6-oji 2027", "long_weekend", date(2027, 7, 3), date(2027, 7, 6), ["weekend"], None, None, None, None),
    ("geguzes-1-2027", "Gegužės 1-oji 2027", "public_holiday", date(2027, 5, 1), date(2027, 5, 2), ["weekend"], None, None, None, None),
    ("home-xmas-2026", "Kalėdoms namo 2026", "custom", date(2026, 12, 18), date(2026, 12, 23), ["home"], date(2027, 1, 2), date(2027, 1, 6), None, "out Dec 18–23 · back Jan 2–6"),
    ("home-easter-2027", "Velykoms namo 2027", "custom", date(2027, 3, 25), date(2027, 4, 5), ["home"], None, None, None, None),
    ("home-summer-2027", "Vasarai namo 2027", "custom", date(2027, 6, 20), date(2027, 7, 5), ["home"], None, None, None, None),
]
```

In `seed_all`, after the moments dict:

```python
    for slug, name, kind, start, end, codes, rstart, rend, src, notes in PEAK_WINDOWS:
        _get_or_create(
            session,
            models.PeakWindow,
            dict(name=name, kind=kind, start_date=start, end_date=end, pref_codes=codes,
                 return_start_date=rstart, return_end_date=rend, source_url=src, notes=notes),
            slug=slug,
        )
```

- [ ] **Step 4: Run** — `uv run pytest tests/skrendam/test_seeds.py tests/skrendam/test_migration.py -q` → PASS (the autogenerate check proves model ↔ migration parity).

- [ ] **Step 5: Commit**

```bash
git add skrendam/db/models.py alembic/versions/0012_demand_layer.py skrendam/seeds.py tests/skrendam/test_seeds.py
git commit -m "feat(db): peak_windows table + match score_v2/archetype/demand_signals (0012); seed 2026-27 windows"
```

### Task 5: `demand.py` — the pure functions

**Files:**
- Create: `skrendam/scanning/scoring/demand.py`
- Test: `tests/skrendam/test_demand.py` (new)

**Interfaces (produced; consumed by Task 6):**

```python
@dataclass(frozen=True)
class Window: slug: str; start: date; end: date; pref_codes: tuple[str, ...]; return_start: date | None = None; return_end: date | None = None
def windows_from_rows(rows) -> list[Window]
def load_personas() -> dict[str, list[str]]
def load_demand_tiers() -> dict
def persona_codes(newsletter_tag: str | None, personas: dict) -> tuple[str, ...]
def commodity_share(series, price: float, now: datetime) -> float | None
def date_fit(travel_date: date, return_date: date | None, codes, windows) -> tuple[float, Window | None]
def demand_weight(destination: str, codes, tiers) -> tuple[str, float]
def window_typical(series, window: Window) -> float | None
def assess(*, headline, scores, template, audience_slug, fare, travel_date, return_date, series, local_median, discount_pct, departure_date_count, now, windows, personas, tiers) -> DemandAssessment  # .score_v2:int .archetype:str|None .signals:dict
```

- [ ] **Step 1: Write the failing tests**

```python
# tests/skrendam/test_demand.py
from datetime import date, datetime, timedelta

from skrendam.db import models
from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring import demand
from skrendam.scanning.scoring.base import Score
from skrendam.scanning.types import FareItinerary

NOW = datetime(2026, 10, 1)
W = demand.Window("rudens-2026", date(2026, 10, 31), date(2026, 11, 8), ("family", "weekend"))
HOME = demand.Window("home-xmas-2026", date(2026, 12, 18), date(2026, 12, 23), ("home",),
                     date(2027, 1, 2), date(2027, 1, 6))
TIERS = {"weights": {"A": 1.0, "B": 0.85, "C": 0.7}, "A": ["BCN"], "B": ["BER"], "vfr": ["STN"]}
PERSONAS = {"family_sun": ["family"], "vfr": ["home"], "last_minute": ["weekend", "last_minute"]}


def _series(day_prices: dict[int, list[float]], travel=date(2026, 11, 2)) -> PriceHistorySeries:
    """day_prices: days-before-NOW -> prices scanned that day."""
    pts = [
        HistoryPoint(scanned_at=NOW - timedelta(days=d, hours=-h),
                     travel_date=travel, price=p)
        for d, prices in day_prices.items() for h, p in enumerate(prices)
    ]
    return PriceHistorySeries(route_id=1, trip_type="roundtrip", points=tuple(pts))


def test_commodity_share_counts_days_whose_min_is_within_tolerance():
    s = _series({d: [30.0 if d % 2 else 80.0, 120.0] for d in range(1, 21)})  # 20 days, 10 at 30€
    assert demand.commodity_share(s, 30.0, NOW) == 0.5
    assert demand.commodity_share(s, 31.0, NOW) == 0.5   # 30 <= 31*1.05
    assert demand.commodity_share(s, 80.0, NOW) == 1.0


def test_commodity_share_none_below_min_days_and_ignores_old_points():
    assert demand.commodity_share(_series({d: [30.0] for d in range(1, 10)}), 30.0, NOW) is None
    old = _series({d: [30.0] for d in range(100, 130)})  # all beyond FLOOR_LOOKBACK_DAYS
    assert demand.commodity_share(old, 30.0, NOW) is None


def test_date_fit_peak_needs_both_legs_inside_a_window_sharing_a_code():
    assert demand.date_fit(date(2026, 11, 2), date(2026, 11, 7), ("family",), [W]) == (demand.DATE_FIT_PEAK, W)
    assert demand.date_fit(date(2026, 11, 2), date(2026, 11, 12), ("family",), [W])[0] == 1.0  # return outside
    assert demand.date_fit(date(2026, 11, 2), date(2026, 11, 7), ("sun",), [W])[0] == 1.0      # no shared code
    assert demand.date_fit(date(2026, 12, 20), date(2027, 1, 4), ("home",), [HOME]) == (demand.DATE_FIT_PEAK, HOME)
    assert demand.date_fit(date(2026, 12, 20), date(2026, 12, 27), ("home",), [HOME])[0] == 1.0  # return not in its range


def test_date_fit_weekend_is_fri_or_sat_out_and_sun_or_mon_back():
    assert demand.date_fit(date(2026, 10, 9), date(2026, 10, 11), ("weekend",), [])[0] == demand.DATE_FIT_WEEKEND  # Fri→Sun
    assert demand.date_fit(date(2026, 10, 10), date(2026, 10, 12), (), [])[0] == demand.DATE_FIT_WEEKEND         # Sat→Mon
    assert demand.date_fit(date(2026, 10, 7), date(2026, 10, 11), (), [])[0] == 1.0                              # Wed out
    assert demand.date_fit(date(2026, 10, 9), None, (), [])[0] == 1.0                                            # one-way


def test_demand_weight_by_tier_and_vfr_for_home():
    assert demand.demand_weight("BCN", (), TIERS) == ("A", 1.0)
    assert demand.demand_weight("BER", (), TIERS) == ("B", 0.85)
    assert demand.demand_weight("XXX", (), TIERS) == ("C", 0.7)
    assert demand.demand_weight("STN", ("home",), TIERS) == ("A", 1.0)   # vfr + home persona
    assert demand.demand_weight("STN", ("weekend",), TIERS) == ("C", 0.7)


def test_window_typical_is_the_median_of_in_window_history_or_none():
    inside = _series({d: [200.0, 300.0] for d in range(1, 6)}, travel=date(2026, 11, 3))  # 10 points
    assert demand.window_typical(inside, W) == 250.0
    thin = _series({1: [200.0]}, travel=date(2026, 11, 3))
    assert demand.window_typical(thin, W) is None
    outside = _series({d: [200.0, 300.0] for d in range(1, 6)}, travel=date(2026, 9, 3))
    assert demand.window_typical(outside, W) is None


def _headline(score100: int, scorer="weighted", signals=None) -> Score:
    return Score(scorer=scorer, value=score100 / 100, score_0_100=score100, quality_tier=None,
                 reason_text="", signals=signals or {})


def _tpl(**over) -> models.DealTemplate:
    base = dict(slug="family-autumn-sun", name="x", trip_type="roundtrip", newsletter_tag="family_sun",
                min_departure_dates=None)
    base.update(over)
    return models.DealTemplate(**base)


def _fare(stops=0) -> FareItinerary:
    return FareItinerary(price=99.0, currency="EUR", stops=stops, duration_minutes=200, legs=[])


def test_assess_date_archetype_boosts_and_reports_window():
    series = _series({d: [200.0, 300.0] for d in range(1, 16)}, travel=date(2026, 11, 3))  # typical 250
    a = demand.assess(headline=_headline(80), scores=[_headline(80)], template=_tpl(), audience_slug="families",
                      destination="XXX", fare=_fare(), travel_date=date(2026, 11, 2), return_date=date(2026, 11, 7),
                      series=series, local_median=250.0, discount_pct=60.4, departure_date_count=None,
                      now=NOW, windows=[W], personas=PERSONAS, tiers=TIERS)
    assert a.archetype == "date"                      # 99 <= 0.6 * 250
    assert a.score_v2 == 70                           # 80 * 1.25 * 0.7 (destination unknown -> C)
    assert a.signals["window_slug"] == "rudens-2026" and a.signals["window_typical"] == 250.0
    assert a.signals["saving_pp"] == 151.0 and a.signals["saving_family"] == 604.0
    assert "rare" in a.signals["archetypes"]          # discount >= 60 also matched, lower precedence


def test_assess_commodity_caps_score_and_no_archetype():
    series = _series({d: [99.0, 150.0] for d in range(1, 21)})   # floor at 99 on every day
    a = demand.assess(headline=_headline(90), scores=[_headline(90)], template=_tpl(newsletter_tag="last_minute"),
                      audience_slug="budget", destination="XXX", fare=_fare(), travel_date=date(2026, 10, 7), return_date=None,
                      series=series, local_median=120.0, discount_pct=17.5, departure_date_count=None,
                      now=NOW, windows=[W], personas=PERSONAS, tiers=TIERS)
    assert a.signals["is_commodity"] is True and a.signals["commodity_share"] == 1.0
    assert a.score_v2 == demand.COMMODITY_CAP and a.archetype is None


def test_assess_rare_skips_demand_weight_and_destination_needs_floor_and_tier():
    rare = demand.assess(headline=_headline(90, "outlier", {"possible_error_fare": True}), scores=[],
                         template=_tpl(newsletter_tag="last_minute"), audience_slug="budget", destination="XXX", fare=_fare(),
                         travel_date=date(2026, 10, 7), return_date=None, series=_series({}),
                         local_median=400.0, discount_pct=75.0, departure_date_count=None,
                         now=NOW, windows=[], personas=PERSONAS, tiers=TIERS)
    assert rare.archetype == "rare" and rare.score_v2 == 90   # weight 0.7 skipped
    dest = demand.assess(headline=_headline(80), scores=[_headline(80)], template=_tpl(newsletter_tag="last_minute", min_departure_dates=5),
                         audience_slug="budget", destination="XXX", fare=_fare(stops=1), travel_date=date(2026, 10, 7), return_date=None,
                         series=_series({}), local_median=300.0, discount_pct=67.0, departure_date_count=5,
                         now=NOW, windows=[], personas=PERSONAS, tiers=TIERS)
    # 201 € saving with a connection (>=150), discount >= 40, but destination unknown -> tier C -> not destination.
    assert "destination" not in dest.signals["archetypes"]
    assert demand.assess(headline=_headline(80), scores=[], template=_tpl(newsletter_tag="last_minute", min_departure_dates=5),
                         audience_slug="budget", destination="XXX", fare=_fare(), travel_date=date(2026, 10, 7), return_date=None,
                         series=_series({}), local_median=300.0, discount_pct=67.0, departure_date_count=5,
                         now=NOW, windows=[], personas=PERSONAS, tiers=TIERS | {"A": ["XXX"]}).signals["archetypes"] == ["rare", "destination"]
```


- [ ] **Step 2: Run** — `uv run pytest tests/skrendam/test_demand.py -q` → FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Implement `skrendam/scanning/scoring/demand.py`**

```python
"""Demand layer (spec 2026-09-10 WP2): who wants this trip, on these dates, at this price.

Pure functions over the headline Score, the template, and the route's price
history. Not a registered Scorer — scorers only ADD matches; this layer also
DEMOTES (commodity fares) and re-ranks (date fit, destination demand). All
thresholds are module constants (spec §6); tiers stay in tiering.py.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from importlib import resources
from statistics import median

from skrendam.scanning.scoring import tiering

COMMODITY_FLOOR_SHARE = 0.20
FLOOR_TOLERANCE = 1.05
FLOOR_LOOKBACK_DAYS = 90      # within the 180-day prefetched series
FLOOR_MIN_DAYS = 14           # fewer scan days -> commodity_share None (unknown != commodity)
COMMODITY_CAP = 40
DATE_FIT_PEAK = 1.25
DATE_FIT_WEEKEND = 1.10
DEMAND_W = {"A": 1.00, "B": 0.85, "C": 0.70}
ABS_SAVING_FLOOR_EUR = 60             # per person, direct
ABS_SAVING_FLOOR_CONNECTING_EUR = 150
MIN_DISCOUNT_PCT = 40                 # destination archetype
DATE_DEAL_MAX_RATIO = 0.60            # fare <= 60% of window_typical
WINDOW_TYPICAL_MIN_POINTS = 10
RARE_DISCOUNT_PCT = 60                # aligns with outlier.DISC_ERROR
FAMILY_SEATS = 4


@dataclass(frozen=True)
class Window:
    slug: str
    start: date
    end: date
    pref_codes: tuple[str, ...]
    return_start: date | None = None
    return_end: date | None = None

    def holds(self, travel_date: date, return_date: date | None) -> bool:
        if not (self.start <= travel_date <= self.end):
            return False
        if return_date is None:
            return True
        lo, hi = (self.return_start or self.start), (self.return_end or self.end)
        return lo <= return_date <= hi


@dataclass(frozen=True)
class DemandAssessment:
    score_v2: int
    archetype: str | None
    signals: dict


def windows_from_rows(rows) -> list[Window]:
    return [
        Window(r.slug, r.start_date, r.end_date, tuple(r.pref_codes or ()), r.return_start_date, r.return_end_date)
        for r in rows
    ]


def _resource(name: str) -> dict:
    return json.loads(resources.files("skrendam").joinpath(name).read_text(encoding="utf-8"))


def load_personas() -> dict[str, list[str]]:
    return _resource("personas.json")


def load_demand_tiers() -> dict:
    return _resource("demand_tiers.json")


def persona_codes(newsletter_tag: str | None, personas: dict) -> tuple[str, ...]:
    return tuple(personas.get(newsletter_tag or "", ()))


def commodity_share(series, price: float, now: datetime) -> float | None:
    """Fraction of recent scan days whose cheapest recorded price sits at or
    below price * FLOOR_TOLERANCE — i.e. how often this fare is just the floor."""
    cutoff = now - timedelta(days=FLOOR_LOOKBACK_DAYS)
    daily_min: dict[date, float] = {}
    for p in series.points:
        if p.scanned_at < cutoff:
            continue
        d = p.scanned_at.date()
        daily_min[d] = min(daily_min.get(d, p.price), p.price)
    if len(daily_min) < FLOOR_MIN_DAYS:
        return None
    hits = sum(1 for m in daily_min.values() if m <= price * FLOOR_TOLERANCE)
    return round(hits / len(daily_min), 3)


def date_fit(travel_date: date, return_date: date | None, codes, windows) -> tuple[float, Window | None]:
    for w in windows:
        if set(w.pref_codes) & set(codes) and w.holds(travel_date, return_date):
            return DATE_FIT_PEAK, w
    if return_date is not None and travel_date.weekday() in (4, 5) and return_date.weekday() in (6, 0):
        return DATE_FIT_WEEKEND, None
    return 1.0, None


def demand_weight(destination: str, codes, tiers: dict) -> tuple[str, float]:
    weights = tiers.get("weights", DEMAND_W)
    if "home" in codes and destination in tiers.get("vfr", ()):
        return "A", weights["A"]
    if destination in tiers.get("A", ()):
        return "A", weights["A"]
    if destination in tiers.get("B", ()):
        return "B", weights["B"]
    return "C", weights["C"]


def window_typical(series, window: Window) -> float | None:
    """Median of recorded prices for travel dates INSIDE the window.

    First use of history for a FIXED calendar window rather than the current
    calendar month: a Christmas-week fare is compared with Christmas-week fares
    from earlier scans, not with December's median. That is what makes
    Christmas-peak fares findable as deals."""
    prices = [p.price for p in series.points if window.start <= p.travel_date <= window.end]
    if len(prices) < WINDOW_TYPICAL_MIN_POINTS:
        return None
    return float(median(prices))


def assess(*, headline, scores, template, audience_slug: str | None, destination: str, fare,
           travel_date: date, return_date: date | None, series, local_median: float,
           discount_pct: float | None, departure_date_count: int | None, now: datetime,
           windows, personas: dict, tiers: dict) -> DemandAssessment:
    codes = persona_codes(template.newsletter_tag, personas)
    share = commodity_share(series, fare.price, now)
    is_commodity = share is not None and share >= COMMODITY_FLOOR_SHARE
    fit, window = date_fit(travel_date, return_date, codes, windows)
    tier, weight = demand_weight(destination, codes, tiers)
    typical = window_typical(series, window) if window else None
    typical_basis = typical if typical is not None else local_median
    discount = discount_pct or 0.0
    saving_pp = round(max(0.0, local_median - fare.price), 2)
    saving_family = round(saving_pp * FAMILY_SEATS, 2) if audience_slug == "families" else None

    archetypes: list[str] = []
    if window is not None and typical_basis > 0 and fare.price <= DATE_DEAL_MAX_RATIO * typical_basis:
        archetypes.append("date")
    rare = (
        bool(headline.signals.get("possible_error_fare"))
        or any(getattr(s, "signals", {}).get("possible_error_fare") for s in scores)
        or any(s.scorer == "error_fare" for s in scores)
        or discount >= RARE_DISCOUNT_PCT
    )
    if rare:
        archetypes.append("rare")
    floor = ABS_SAVING_FLOOR_EUR if fare.stops == 0 else ABS_SAVING_FLOOR_CONNECTING_EUR
    enough_dates = template.min_departure_dates is None or (
        departure_date_count is not None and departure_date_count >= template.min_departure_dates
    )
    if saving_pp >= floor and discount >= MIN_DISCOUNT_PCT and tier in ("A", "B") and enough_dates:
        archetypes.append("destination")
    primary = next((a for a in ("date", "rare", "destination") if a in archetypes), None)

    applied_weight = 1.0 if primary == "rare" else weight
    score_v2 = max(0, min(100, round(headline.score_0_100 * fit * applied_weight)))
    if is_commodity:
        score_v2 = min(score_v2, COMMODITY_CAP)
    return DemandAssessment(
        score_v2=score_v2,
        archetype=primary,
        signals={
            "commodity_share": share,
            "is_commodity": is_commodity,
            "date_fit": fit,
            "demand_tier": tier,
            "demand_weight": applied_weight,
            "window_slug": window.slug if window else None,
            "window_typical": typical,
            "saving_pp": saving_pp,
            "saving_family": saving_family,
            "archetypes": archetypes,
            "quality_tier_v2": tiering.quality_tier(score_v2),
        },
    )
```

- [ ] **Step 4: Run** — `uv run pytest tests/skrendam/test_demand.py -q` → PASS. Then `uv run ruff check skrendam tests && uv run ruff format skrendam tests`.

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/demand.py tests/skrendam/test_demand.py
git commit -m "feat(demand): pure demand layer — commodity share, date fit, window typical, archetypes, score_v2"
```

### Task 6: Wire the demand layer into the orchestrator and persist it

**Files:**
- Modify: `skrendam/db/repositories.py` (`upsert_match` kwargs)
- Modify: `skrendam/scanning/orchestrator.py` (`run_scan` loads windows/audiences/resources; `_persist_fare` calls `demand.assess`)
- Test: `tests/skrendam/test_orchestrator.py` (two new tests)

**Interfaces:**
- Consumes: `demand.assess`, `demand.windows_from_rows`, `demand.load_personas`, `demand.load_demand_tiers` (Task 5); `history.for_route(route_id, trip_type, duration_days)`.
- Produces: `upsert_match(..., score_v2: int | None = None, archetype: str | None = None, demand_signals: dict | None = None)`; `_persist_fare(..., demand_ctx: DemandContext)` where `DemandContext(windows, audience_slug: dict[int,str], personas, tiers)` is a small dataclass in `orchestrator.py`.

- [ ] **Step 1: Write the failing tests** (append to `tests/skrendam/test_orchestrator.py`; reuse `_seed`, `FakeBackend`)

```python
def test_run_scan_persists_score_v2_archetype_and_signals(session):
    _seed(session)
    adapter = FliAdapter(FakeBackend(), pace=lambda: None)
    run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    m = session.query(models.CandidateTemplateMatch).first()
    assert m is not None
    assert m.score_v2 is not None and 0 <= m.score_v2 <= 100
    assert m.archetype in (None, "date", "rare", "destination")
    assert set(m.demand_signals) >= {"commodity_share", "is_commodity", "date_fit", "demand_weight",
                                     "window_slug", "window_typical", "saving_pp", "saving_family", "archetypes"}
    assert m.demand_signals["commodity_share"] is None  # no history yet -> unknown, not commodity


class EarlyBirdBackend(FakeBackend):
    def search_flights(self, origin, destination, travel_date, return_date, cabin):
        fares = super().search_flights(origin, destination, travel_date, return_date, cabin)
        for f in fares:
            f["legs"] = [{"airline": {"code": "W6"}, "departure_time": f"{travel_date}T05:50:00",
                          "arrival_time": f"{travel_date}T08:30:00"}]
        return fares


def test_family_friendly_template_rejects_0550_departure(session):
    _seed(session)
    tpl = session.get(models.DealTemplate, 1)
    tpl.family_friendly_times_only = True
    session.commit()
    adapter = FliAdapter(EarlyBirdBackend(), pace=lambda: None)
    summary = run_scan(session, today=date(2026, 6, 2), adapter=adapter, scanner_version="t")
    assert summary.matches_created == 0
```

- [ ] **Step 2: Run** — `uv run pytest tests/skrendam/test_orchestrator.py -q -k "score_v2 or 0550"` → FAIL (`score_v2` None; time gate not enforced — it is enforced by Task 2 already, so the second test may pass; keep it as a regression guard).

- [ ] **Step 3: Implement**

`skrendam/db/repositories.py::upsert_match` — add parameters `score_v2: int | None = None, archetype: str | None = None, demand_signals: dict | None = None`; set them on the new row and on `existing` (next to the headline fields, both paths).

`skrendam/scanning/orchestrator.py`:

```python
from dataclasses import dataclass
from skrendam.scanning.scoring import demand, tiering

@dataclass(frozen=True)
class DemandContext:
    windows: list
    audience_slug: dict
    personas: dict
    tiers: dict
```

In `run_scan` after `templates = list(...)`:

```python
    demand_ctx = DemandContext(
        windows=demand.windows_from_rows(session.scalars(select(models.PeakWindow)).all()),
        audience_slug={a.id: a.slug for a in session.scalars(select(models.AudienceSegment))},
        personas=demand.load_personas(),
        tiers=demand.load_demand_tiers(),
    )
```

Pass `demand_ctx` through the existing `_persist_fare(...)` call (add a `demand_ctx` parameter at the end of its signature). In `_persist_fare`, replace the match loop:

```python
    demand_series = history.for_route(route.id, spec.trip_type, spec.duration_days)
    for tpl, headline, scores in matched:
        dm = demand.assess(
            headline=headline, scores=scores, template=tpl,
            audience_slug=demand_ctx.audience_slug.get(tpl.audience_segment_id),
            destination=spec.destination, fare=fare,
            travel_date=point.travel_date, return_date=point.return_date,
            series=demand_series, local_median=local_median, discount_pct=discount,
            departure_date_count=departure_date_count, now=now,
            windows=demand_ctx.windows, personas=demand_ctx.personas, tiers=demand_ctx.tiers,
        )
        _match, created = repo.upsert_match(
            session, cand.id, tpl.id, headline.value, headline.reason_text, headline.signals,
            score_0_100=headline.score_0_100,
            quality_tier=tiering.quality_tier(dm.score_v2),   # D6: tier follows score_v2
            primary_scorer=headline.scorer,
            score_v2=dm.score_v2, archetype=dm.archetype, demand_signals=dm.signals,
        )
        ...rest unchanged (scores, draft)
```

- [ ] **Step 4: Run the whole suite** — `uv run pytest tests/skrendam -q` → PASS; `uv run ruff check . && uv run ruff format --check .`.

- [ ] **Step 5: Commit**

```bash
git add skrendam/db/repositories.py skrendam/scanning/orchestrator.py tests/skrendam/test_orchestrator.py
git commit -m "feat(scan): persist score_v2/archetype/demand_signals per match; tier follows score_v2"
```

### Task 7: `family-xmas-sun` template + launch-priority SQL

**Files:**
- Modify: `skrendam/seeds.py` (template beside the other family fixed-window templates), `tests/skrendam/test_seeds.py`, `tests/skrendam/test_cli.py`, `tests/skrendam/test_e2e_pipeline.py` (template counts)
- Create: `scripts/2026-09-11_launch_priority.sql`

- [ ] **Step 1: Failing test** (append to `test_seeds.py`; also bump `DealTemplate` count 14 → 15 in `test_seed_is_idempotent`, `templates_scanned == 15` in `test_cli.py` and `test_e2e_pipeline.py`; re-derive `E2E_*` counts empirically as on 2026-08-29 and update the derivation comment)

```python
def test_family_xmas_sun_is_seeded_with_the_date_archetype_window(session):
    seed_all(session)
    t = session.query(models.DealTemplate).filter_by(slug="family-xmas-sun").one()
    assert (t.fixed_start_date, t.fixed_end_date) == (date(2026, 12, 18), date(2026, 12, 28))
    assert t.included_destinations == ["TFS", "LPA", "HRG", "SSH", "DXB", "RAK"]
    assert (t.max_price_eur, t.min_discount_pct, t.min_departure_dates) == (450, 20, 3)
    assert t.family_friendly_times_only and t.newsletter_tag == "family_sun"
```

- [ ] **Step 2: Run** → FAIL (`NoResultFound`).

- [ ] **Step 3: Implement** — in `seeds.py` templates list after `family-easter-sun`:

```python
        # Founder decision 3 (2026-09-10): the date archetype (window_typical from
        # history) is what lets Christmas-peak fares surface; this cap is not the gate.
        dict(
            slug="family-xmas-sun",
            name="Family Christmas-break sun",
            audience="families",
            moment="school_holidays",
            trip_type="roundtrip",
            date_window_type="fixed",
            fixed_start_date=LT_XMAS_BREAK[0],
            fixed_end_date=LT_XMAS_BREAK[1],
            included_destinations=WINTER_WARM,
            trip_len_min_days=5,
            trip_len_max_days=10,
            max_stops=1,
            allow_overnight_layover=False,
            allow_airport_change=False,
            family_friendly_times_only=True,
            max_price_eur=450,
            min_discount_pct=20,
            min_departure_dates=3,
            public_label="Family sun",
            newsletter_tag="family_sun",
            content_angle="Christmas-break warmth (Dec 21 - Jan 3) - real sun only",
        ),
```

`scripts/2026-09-11_launch_priority.sql`:

```sql
-- Launch priority (spec 2026-09-10 WP2.10): desk Today defaults to priority >= 100.
BEGIN;
UPDATE deal_templates SET priority = 100, updated_at = now()
WHERE slug IN ('family-autumn-sun','family-feb-sun','family-easter-sun','family-xmas-sun',
               'plan-ahead-summer','last-minute-weekends','christmas-markets',
               'last-warm-days-november','winter-sun-escape');
COMMIT;
-- verify: SELECT slug, priority FROM deal_templates ORDER BY priority DESC, slug;
```

- [ ] **Step 4: Run** — `uv run pytest tests/skrendam -q` → PASS (after count updates).

- [ ] **Step 5: Commit**

```bash
git add skrendam/seeds.py tests/skrendam scripts/2026-09-11_launch_priority.sql
git commit -m "feat(seeds): family-xmas-sun (founder decision 3) + launch-priority SQL"
```

### Task 8: Curator-label proxy report (`analyze.py`)

**Files:**
- Modify: `skrendam/analyze.py` (`label_report(session) -> str`), `skrendam/cli.py` (`analyze --labels [--out PATH]`)
- Test: `tests/skrendam/test_analyze.py`

**Interfaces:** `label_report(session) -> str` (markdown); buckets: price band `<50 | 50–99 | 100–199 | 200+`, commodity bucket `unknown | <0.2 | 0.2–0.5 | ≥0.5` from `demand_signals["commodity_share"]`; rows = zone × template × price band × commodity bucket with `approved`, `rejected`, `approval_rate`.

- [ ] **Step 1: Failing test**

```python
def test_label_report_groups_approval_rate_by_zone_template_band_and_commodity(session):
    from skrendam.analyze import label_report
    from skrendam.seeds import seed_all
    seed_all(session)
    route = session.query(models.Route).filter_by(origin="VNO", destination="BCN").one()
    tpl = session.query(models.DealTemplate).filter_by(slug="last-warm-days").one()
    for i, (status, share) in enumerate([("approved", 0.1), ("rejected", 0.6), ("approved", None)]):
        c = models.Candidate(route_id=route.id, origin="VNO", destination="BCN", zone="MEDITERRANEAN",
                             trip_type="roundtrip", travel_date=date(2026, 10, 5), price=120.0 + i,
                             status=status, deal_group_key=f"k{i}")
        session.add(c); session.flush()
        session.add(models.CandidateTemplateMatch(candidate_id=c.id, deal_template_id=tpl.id, match_score=0.9,
                                                  demand_signals={"commodity_share": share}))
    session.commit()
    md = label_report(session)
    assert "| MEDITERRANEAN | Last warm days (October) | 100–199 | <0.2 | 1 | 0 | 100% |" in md
    assert "| MEDITERRANEAN | Last warm days (October) | 100–199 | ≥0.5 | 0 | 1 | 0% |" in md
    assert "| unknown |" in md
```

- [ ] **Step 2: Run** → FAIL (`ImportError`).

- [ ] **Step 3: Implement** in `analyze.py`:

```python
def _price_band(p: float) -> str:
    return "<50" if p < 50 else "50–99" if p < 100 else "100–199" if p < 200 else "200+"


def _commodity_bucket(share) -> str:
    if share is None:
        return "unknown"
    return "<0.2" if share < 0.2 else "0.2–0.5" if share < 0.5 else "≥0.5"


def label_report(session: Session) -> str:
    """Curator labels (approved/rejected) as a proxy for 'what counts as a deal',
    grouped by zone × template × price band × commodity bucket (spec WP2.11)."""
    rows = session.execute(
        select(models.Candidate.zone, models.DealTemplate.name, models.Candidate.price,
               models.Candidate.status, models.CandidateTemplateMatch.demand_signals)
        .join(models.CandidateTemplateMatch, models.CandidateTemplateMatch.candidate_id == models.Candidate.id)
        .join(models.DealTemplate, models.DealTemplate.id == models.CandidateTemplateMatch.deal_template_id)
        .where(models.Candidate.status.in_(("approved", "rejected")))
    ).all()
    agg: dict[tuple, list[int]] = {}
    for zone, tname, price, status, signals in rows:
        key = (zone, tname, _price_band(price), _commodity_bucket((signals or {}).get("commodity_share")))
        a = agg.setdefault(key, [0, 0])
        a[0 if status == "approved" else 1] += 1
    lines = ["| zone | template | price band | commodity | approved | rejected | approval |",
             "|---|---|---|---|---|---|---|"]
    for (zone, tname, band, bucket), (ok, no) in sorted(agg.items()):
        rate = f"{round(100 * ok / (ok + no))}%"
        lines.append(f"| {zone} | {tname} | {band} | {bucket} | {ok} | {no} | {rate} |")
    return "\n".join(lines)
```

`cli.py`: `an = sub.add_parser("analyze"); an.add_argument("--labels", action="store_true"); an.add_argument("--out")` — when `--labels`, print `label_report(session)` and, if `--out`, write it there. (Read the existing `analyze` command branch in `main()` first and extend it in place.)

- [ ] **Step 4: Run** — `uv run pytest tests/skrendam/test_analyze.py tests/skrendam/test_cli.py -q` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(analyze): curator-label proxy report (--labels)"` (add the new files explicitly).

### Task 9: Apply to the live DB, open the PR, verify after one scan

- [ ] **Step 1: Full suite + lint** — `uv run pytest tests/skrendam -q && uv run ruff check . && uv run ruff format --check .` → green.
- [ ] **Step 2: Migration protocol (§B)** — VPN off; `alembic upgrade head`; `skrendam seed` (adds 13 peak windows + `family-xmas-sun`); `psql ... -f scripts/2026-09-11_launch_priority.sql`; `drizzle-kit pull` in `web/` and `site/`; commit the regenerated schemas. Verify:

```sql
SELECT count(*) FROM peak_windows;                                   -- 13
SELECT slug, priority FROM deal_templates WHERE priority >= 100;    -- 9 rows
SELECT column_name FROM information_schema.columns WHERE table_name='candidate_template_matches' AND column_name IN ('score_v2','archetype','demand_signals');  -- 3
```

- [ ] **Step 3: PR + merge** — `git push -u origin feat/wp2-demand-layer`; `gh pr create` (body: the acceptance list below); `gh run watch <id> --exit-status`; from the main checkout `gh pr merge <n> --merge --delete-branch && git pull --ff-only`. The next 06:00 scan runs the new code (`daily-scan.sh` runs from the main checkout).
- [ ] **Step 4: Acceptance after one healthy scan** (spec WP2):

```sql
-- every new match carries v2 fields
SELECT count(*) FILTER (WHERE score_v2 IS NULL) AS missing, count(*) AS total
FROM candidate_template_matches m JOIN candidates c ON c.id=m.candidate_id WHERE c.first_seen_at > current_date;
-- no commodity fare in the v2 top 20
SELECT m.score_v2, (m.demand_signals->>'is_commodity') AS commodity FROM candidate_template_matches m
JOIN candidates c ON c.id=m.candidate_id WHERE c.status='new' ORDER BY m.score_v2 DESC NULLS LAST LIMIT 20;
-- family-xmas-sun produced specs / matches
SELECT count(*) FROM candidate_template_matches m JOIN deal_templates t ON t.id=m.deal_template_id WHERE t.slug='family-xmas-sun';
-- Google load unchanged
SELECT id, api_calls, http_429s, status FROM scan_runs ORDER BY started_at DESC LIMIT 2;
```

Also: `uv run skrendam analyze --labels --out docs/research/2026-09-1X-curator-label-proxy.md` and commit the report. Write `docs/handoffs/2026-09-1X-wp2-demand-layer.md`; update `docs/PROJECT.md` §7.

---

## E. WP0 — Launch hygiene (site only; runs in parallel with WP2)

Worktree `wp0-hygiene`, branch `feat/wp0-launch-hygiene`, `cd site && npm ci`.

### Task 0.1: Signup capture (source `tiktok`, `utm_*`, `ref`; drop the free early-alerts checkbox)

**Files:** `site/src/lib/subscribe-prefs.ts`, `site/src/app/subscribe-action.ts`, `site/src/components/SignupCard.tsx`, `site/src/app/subscribe/page.tsx`, test `site/src/lib/subscribe.test.ts`.

- [ ] Test (vitest): `cleanSource('tiktok') === 'tiktok'`; `cleanUtm({utm_source:'tiktok', utm_content:'v123', junk:'x'})` → `{source:'tiktok', content:'v123'}` (keys limited to `source, medium, campaign, content, term`, values trimmed and capped at 80 chars); `cleanRef('ab3x')` → `'ab3x'` and `cleanRef('<script>')` → `null` (`/^[a-z0-9]{2,12}$/`).
- [ ] Implement in `subscribe-prefs.ts`: add `'tiktok'` to `SUBSCRIBE_SOURCES`; export `cleanUtm(input: Record<string, unknown>)` and `cleanRef(raw: unknown): string | null`.
- [ ] `subscribe-action.ts`: read `utm_source/utm_medium/utm_campaign/utm_content/utm_term` and `ref` from hidden form fields (the forms already post `source`; add hidden inputs populated from `useSearchParams` in `SignupCard` — client component — and from `searchParams` on the subscribe page); on insert set `prefs: { utm, referred_by }` (only the keys present); on the conflict path merge with `sql\`coalesce(${subscribers.prefs}, '{}'::json)\`` untouched (don't overwrite an existing subscriber's prefs). Stop reading `early_alerts` from the free forms (leave the `/early-alerts` page path intact for WP6.4).
- [ ] Remove the checkbox blocks: `SignupCard.tsx` (the `<label className="cap-early">…</label>` and the `cap-div` above it) and `subscribe/page.tsx` (`<div className="sub-ea-row">…</div>`). No other layout change.
- [ ] `npx vitest run && npx tsc --noEmit && npx eslint src` → green. Commit: `feat(site): capture tiktok/utm/ref on signup; free form no longer offers early alerts`.

### Task 0.2: Referral code helper (no migration)

**Files:** `site/src/lib/refcode.ts`, `web/src/lib/refcode.ts` (identical copy), tests in both.

```ts
// refcode.ts — base36(id) + 1-char checksum; decodes back to the subscriber id.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export function refCode(id: number): string {
  const body = id.toString(36);
  const sum = [...body].reduce((a, ch) => a + ALPHABET.indexOf(ch), 0);
  return body + ALPHABET[sum % 36];
}
export function parseRefCode(code: string): number | null {
  if (!/^[0-9a-z]{2,12}$/.test(code)) return null;
  const body = code.slice(0, -1);
  return refCode(parseInt(body, 36)) === code ? parseInt(body, 36) : null;
}
```

- [ ] Tests: round-trip for ids `1, 35, 36, 1295, 123456`; `parseRefCode('zz')` (bad checksum) → `null`. Commit.

### Task 0.3: Kipras collection — `destinations` filter kind

**Files:** `site/src/lib/collections.ts`, `site/src/lib/queries.ts`, `site/src/lib/collections.test.ts`.

- [ ] Test: `collectionBySlug('cyprus-flight-deals-from-lithuania')!.filter` equals `{ kind: 'destinations', iatas: ['LCA', 'PFO'] }`.
- [ ] Implement: add `| { kind: 'destinations'; iatas: string[] }` to `CollectionFilter`; in `getCollectionDeals` add a branch `if (filter.kind === 'destinations') return split(dedupeById(await dealBase().where(and(eq(publishedDeals.status,'live'), inArray(publishedDeals.destination, filter.iatas))).orderBy(...LIVE_ORDER)));` (import `inArray`). Also `zoneCollection()` no longer matches Cyprus — check the deal page's interlink still compiles (`origColl`/`zoneCollection` callers). Commit.

### Task 0.4: Expose, don't design

**Files:** `site/src/lib/queries.ts` (`dealBase` select), `site/src/lib/mappers.ts`, `site/src/lib/types.ts`, new `site/src/lib/ground.ts`, tests.

- [ ] Now (no WP2 dependency): select `verifiedAt: candidates.verifiedAt` in `dealBase`; `PublicDeal` gains `verifiedAt: string | null` and `groundHint: string | null` from `groundHint(origin)` → `KUN: 'Iš Vilniaus: 59 min traukiniu'`, `RIX: 'Iš Vilniaus: traukinys nuo €9.60, ~4 val.'`, else `null` (spec §7/§10).
- [ ] After WP2's drizzle pull lands on main (rebase this branch): select `scoreV2`, `archetype`, `demandSignals` from `candidateTemplateMatches`; `PublicDeal` gains `archetype: 'date'|'rare'|'destination'|null`, `windowSlug: string|null`, `savingFamily: number|null` (from `demandSignals.saving_family`). Mapper tests for both. Commit.

### Task 0.5: Privacy page

**Files:** `site/src/app/privatumas/page.tsx` (new), `site/src/lib/lt.ts` (`footerPrivacy: 'Privatumas'`), `site/src/components/v2/V2Footer.tsx` (one link), `site/src/app/sitemap.ts` (add `/privatumas`).

- [ ] Plain server component, no styling beyond `<main className="v2"><section className="wrap">`: title „Privatumo politika", paragraphs: duomenų valdytojas (Yip, Vilnius, kontaktas per `footerContact`), kokius duomenis renkam (el. paštas, pasirinkimai — miestai/momentai, prenumeratos šaltinis ir UTM žymos, nuorodos paspaudimai laiškuose), tikslas (radinių siuntimas el. paštu, paslaugos tobulinimas), tvarkytojai (Resend — el. laiškų siuntimas; Neon — duomenų saugojimas ES), saugojimo trukmė (kol prenumerata aktyvi; atsisakius — ištrinama per 30 d.), teisės (peržiūrėti, ištaisyti, ištrinti, atsisakyti bet kada per nuorodą laiške), atnaujinta 2026-09-XX. Metadata title „Privatumas · Yip". Commit.

### Task 0.6 (founder): publish ≥ 12 live deals across ≥ 3 moments from the desk; expire dead ones.

PR `feat/wp0-launch-hygiene` → CI → merge (site auto-deploys to yip.lt).

---

## F. Phase plans for WP3, WP6, WP7, WP8 (task-level; each gets its own detailed plan written when its phase starts — they depend on WP2's persisted shapes and on decisions D1/D2)

### WP3 — Deal Desk: today's ten, half-written (`feat/wp3-desk-today`; after WP2 + drizzle pull)

1. **Data plumbing** — `web/src/lib/queries.ts::queueBase` selects `scoreV2: candidateTemplateMatches.scoreV2`, `archetype`, `demandSignals`, `templatePriority: dealTemplates.priority`; `CandidateView` gains `scoreV2: number | null`, `archetype`, `commodityShare: number | null`, `savingFamily: number | null`, `personas: string[]` (from `web/src/lib/personas.json[newsletterTag]`), `priority: number`; mapper in the queue page. Test: `web/src/lib/shortlist.test.ts`.
2. **Today** — `shortlist.ts`: `TODAY_N = 10`; `shortlistIds(rows, limit)` ranks by `scoreV2 ?? score`; default filter `priority >= 100` with a "show all templates" toggle in `QueueBoard`; chips: archetype (date/rare/destination), persona codes, `commodity_share` (only when ≥ 0.2), `saving_family` on `families` rows; keep supersede/route-context chips. Coverage tab gets a `priority` column.
3. **Drafts** — `skrendam/scanning/content.py::build_content_draft(..., signals: dict | None = None, fare=None)` fills `body` = *kodėl verta* (window name for date deals, else "€X vs įprastai €Y" only when `(baseline − price)/baseline ≥ WAS_PRICE_MIN_DISCOUNT`) + *kabliukas* lines (stops from `fare.stops`; „išvyksta prieš 07:00" from `leg_hours`; `card.bagOnlyHand` when the snapshot's fare brand says hand-luggage only — else omit; `card.fromVilnius`/`card.fromRiga` for KUN/RIX; a weather line for `sun` templates from a static month table). Rules-based LT strings from spec §7. `CopyDrafter` gets a `body` tab (`Tab = 'headline'|'hook'|'news'|'body'`); `Composer` prefills `body` into `publishDeal`. Tests in `test_content.py`.
4. **Publish** — unchanged path; WP6 hooks the instant send here.
5. **Subscribers view** — new page `(app)/subscribers`: table of `email, plan, prefs.moments/origins, prefs.utm.source, referred count (parseRefCode over prefs.referred_by), created_at`; manual `plan` flip (paid ↔ free) server action — **needs WP6's `plan` column**, so this page lands in WP6.

Acceptance (spec): desk → 1–3 published deals in ≤ 10 min using drafts.

### WP6 — Email: two streams (`feat/wp6-email-streams`; after WP3)

1. **Migration `0013_email_streams`** — `subscribers.plan text NOT NULL DEFAULT 'free'`, `paid_since`, `paid_source`; `issues(id, kind, sent_at, deal_ids json, expired_deal_ids json, stats json, created_at)`; `deal_events(id, deal_id, issue_id, subscriber_id, kind, source, created_at)`; `published_deals.expired_at` (+ backfill `COALESCE(valid_until, last_seen_at)` for `status='expired'`); models + `alembic check` test; drizzle pull both apps.
2. **Sender in `web/`** — add `resend` dependency; `web/src/lib/email/` with `renderInstant(deal)`, `renderDigest(issue)`, `renderNurture(issue)` (HTML in the confirm-email style from `site/src/lib/email.ts`; LT strings from spec §7; every deal link is `/go/<dealId>?i=<issueId>&s=<subscriberId>` on the site), `sendToPlan(plan, prefs filter, render)`; unsubscribe link on both streams.
3. **Instant paid stream** — `publishDeal` action: after insert, `sendInstant(deal)` to `plan='paid'` subscribers whose `prefs.origins` is empty or contains the deal origin; `rare` archetype first. Never to `plan='free'` (test).
4. **Issue page** `(app)/issue` — two modes: *paid digest* (all finds since the last `issues.kind='paid_digest'`, `family`/`home` blocks first per subscriber prefs) and *free nurture* (`FREE_LETTER_FRESH = 2` fresh + `FREE_LETTER_MISSED = 3` expired with `lasted_hours = expired_at − published_at` and the real price + upgrade ask with Payment Link + `ref`). Preview → save `issues` row → **Send** (D1). Stats written back to `issues.stats`.
5. **`early_alerts` becomes a paid flag** — free forms already stopped offering it (WP0.1); `/early-alerts` page becomes the paid-interest capture (sets `prefs.founding_interest = true`); default `early_alerts = true` when `plan` flips to paid. Existing opt-ins: one-off SQL sets `prefs.founding_interest = true`.
6. **Tracking** — site routes `/go/[dealId]` (302 to `booking_url`, inserts `deal_events(kind='click')`) and `/uzsisakiau/[dealId]` („Užsisakiau" one per subscriber, `kind='booked_claim'`); both stamp `issue_id`.
7. **Subscribers page** (from WP3.5) with the manual `plan` flip; Stripe Payment Link URL as env `NEXT_PUBLIC_PAYMENT_LINK`.
8. **Deliverability (founder)** — SPF/DKIM/DMARC on `yip.lt` in Resend; test send to Gmail/Apple Mail/Outlook.

Acceptance (spec §4 WP6): publish → paid email within a minute; nurture renders in three clients; events carry `issue_id`; DMARC passes; a free subscriber never receives the instant stream.

### WP7 — `home` persona: reverse diaspora cohort (`feat/wp7-home-persona`; before mid-October)

1. `PREF_MOMENTS` += `{ code: 'home', label: 'Grįžtu namo iš užsienio' }` (site) — `personas.json` already maps `home`.
2. Seed reverse routes in `ROUTES` after verifying each against the current schedule (`STN/LTN→KUN`, `STN/LTN→VNO`, `DUB→KUN`, `DUB→VNO`, `OSL→VNO`, `OSL→KUN`, `BGO→KUN`, `CPH→VNO`, `MAN→KUN`; zone `WESTERN_EUROPE`; `core=True` Oct→mid-Dec via SQL flip, tail otherwise). `tests/skrendam/test_seeds.py::test_route_list_size_and_validity` currently asserts every origin ∈ {VNO,KUN,RIX} and `test_shared_data.py` only counts LT-origin codes — both tests must be widened. Keep `scan_runs.api_calls` ≈ 900 (shrink the list, never add passes).
3. Templates `home-xmas`, `home-easter`, `home-summer` (`audience='vfr'`, `moment='vfr_visit'`, `newsletter_tag='home'`, `included_origins` = abroad airports, `included_destinations=['VNO','KUN']`, fixed windows from `PEAK_WINDOWS` `home-*`).
4. Desk assumptions: `getRouteOrigins()` already lists abroad origins as tabs (label lookup falls back to the code — add labels); `routeContext.ts` has no origin assumption (verified); site `cities-lt.ts` covers the new codes via `airports.json` (add any missing city names).

### WP8 — Instrumentation (`feat/wp8-instrumentation`; alongside WP6)

Desk page `(app)/issue/[id]/stats`: `deal_events` per issue — clicks and booked-claims by archetype × pref code × origin × plan; free→paid conversion per nurture issue (`subscribers.paid_since` between sends); TikTok attribution: signups by `prefs.utm.content`. Replaces §6 constants after ~8 issues (a founder review, not code).

---

## G. Definition of done ↔ spec §8

| Spec DoD | Where in this plan |
|---|---|
| WP2 live: `score_v2`/archetypes on every new match, time gates, `family-xmas-sun`, priorities, `api_calls` unchanged | §D Tasks 2–9 (acceptance SQL in Task 9) |
| WP3: Today with body drafts; both issue modes | §F WP3 (issue modes in WP6.4 because the `issues` table ships with `0013`) |
| WP6: instant paid email on publish; one nurture + one digest sent with tracked clicks; free form without early alerts; Payment Link + manual flip | §F WP6 + WP0.1 |
| WP0: source/utm/ref; Kipras; privacy; ≥ 12 live deals | §E |
| WP7 before mid-October; WP8 alongside WP6 | §F |

## Self-review notes

- Spec coverage: every WP2 item 1–12 maps to Tasks 2–8; spec §5 schema list is covered by `0012` (+ `0013` in WP6, which also adds the `expired_at` the spec forgot). WP2.10's "Coverage tab shows priority" is a `web/` change and is scheduled in WP3.2 to keep the WP2 PR Python-only.
- Naming: `demand.assess` kwargs, `DemandContext`, `upsert_match` kwargs and the `demand_signals` keys (`commodity_share, is_commodity, date_fit, demand_tier, demand_weight, window_slug, window_typical, saving_pp, saving_family, archetypes, quality_tier_v2`) are used identically in Tasks 5, 6, 8, WP3 and WP0.4.
