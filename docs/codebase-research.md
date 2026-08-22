# Codebase Research: Skrendam / Fli Monorepo

> Generated 2026-06-11 on branch `feat/site-cro-redesign`. Read-only analysis — documents the
> architecture, key modules, data flows, integration points, and conventions of the entire
> repository. File paths are relative to the repo root.

---

## 1. What this repository is

This is a **polyglot monorepo containing two products that share one repo**:

1. **Fli** — an open-source flight-search toolkit that talks to the (reverse-engineered) Google
   Flights API directly. It ships as a Python package (`flights` on PyPI: library + Typer CLI +
   MCP server) and a byte-compatible TypeScript port (`fli-js` on npm).
2. **Skrendam / Yip** — a curated Baltic flight-deals product built *on top of* fli:
   - `skrendam/` — the Python deal engine (scanner, scorer, curator queue, worker, scheduler)
   - `web/` — Next.js curator admin ("Deal Desk", port 3000)
   - `site/` — Next.js public site (the "opportunity inbox", port 3001)

The three Skrendam components integrate through a **shared Neon Postgres database** — there is no
internal API between them. The Next.js apps never call Google Flights themselves (fli is
Python-only); they enqueue work for the Python worker via a `scan_requests` table.

```
                         ┌────────────────────┐
                         │   Google Flights    │  (reverse-engineered private API)
                         └─────────┬──────────┘
                                   │ HTTPS (rate-limited 10 req/s)
                 ┌─────────────────┴───────────────────┐
                 │              fli (Python)            │  also: fli-js (TS port, npm)
                 │  models → core → search → CLI / MCP  │  released independently to PyPI
                 └─────────────────┬───────────────────┘
                                   │ fli_adapter (paced ~0.67 req/s + circuit breaker)
                 ┌─────────────────┴───────────────────┐
                 │        skrendam/ deal engine          │  CLI: skrendam {run-scan, seed,
                 │  resolver → calendar → baseline →     │  calibrate, worker, analyze}
                 │  detail → matching → candidates       │  cron: daily 06:00 Europe/Vilnius
                 └─────────────────┬───────────────────┘
                                   │ SQLAlchemy + Alembic
                      ┌────────────┴────────────┐
                      │   Neon Postgres (shared) │  ← single integration contract
                      └────┬───────────────┬────┘
              Drizzle ORM  │               │  Drizzle ORM (introspected schema)
        ┌──────────────────┴───┐      ┌────┴──────────────────────┐
        │  web/ curator admin   │      │  site/ public site         │
        │  queue → review →     │      │  deals, collections,       │
        │  publish; 5 config    │      │  signup (double opt-in),   │
        │  editors; enqueues    │      │  SEO/GEO; Resend email     │
        │  scan_requests        │      │  (off until RESEND_API_KEY)│
        └──────────────────────┘      └───────────────────────────┘
```

---

## 2. Top-level layout

| Path | What it is |
|---|---|
| `fli/` | Python library: Google Flights client, CLI, MCP server |
| `fli-js/` | TypeScript 1:1 port of fli, published to npm (Bun toolchain) |
| `skrendam/` | Python deal engine: scanning pipeline, worker, scheduler, DB models |
| `web/` | Next.js 16 curator admin (Deal Desk), dev port 3000 |
| `site/` | Next.js 16 public deals site, dev port 3001 |
| `alembic/` + `alembic.ini` | DB migrations for the skrendam schema (5 revisions) |
| `tests/` | pytest suites mirroring `fli/` and `skrendam/` (+ `tests/scripts/`) |
| `data/` | `airports.csv`, `airlines.csv` — shared enum source for fli **and** fli-js codegen |
| `docs/` + `mkdocs.yml` | MkDocs Material docs site for fli (builds to `_docs_build/`) |
| `examples/` | Runnable fli examples (`examples/python/`, `examples/typescript/`) |
| `scripts/` | Release tooling, notably `scripts/bump_version.py` |
| `.github/workflows/` | CI + independent PyPI / npm / Docker / docs pipelines |
| `.claude/skills/yip-design-system/` | Yip brand/design-system skill (tokens, UI kits, copy rules) |
| `Dockerfile`, `docker-compose.yml` | Container for the fli MCP HTTP server (port 8000) |
| `railway.toml`, `nixpacks.toml` | Railway deployment of `fli-mcp-http` |
| `Makefile`, `tox.ini`, `pytest.ini`, `pyproject.toml` | Python dev tooling |

Console entry points (`pyproject.toml:67-72`): `fli`, `fli-mcp`, `fli-mcp-http`, `skrendam`,
`skrendam-scheduler`.

---

## 3. Subsystem: `fli/` — Google Flights library (Python)

### 3.1 Layering

Strict bottom-up dependency order; CLI and MCP are sibling frontends over the same core:

```
models (fli/models) → core (fli/core) → search (fli/search) → { cli (fli/cli), mcp (fli/mcp) }
```

| Layer | Modules | Responsibility |
|---|---|---|
| **Models** | `fli/models/airport.py`, `airline.py`, `google_flights/{base,flights,dates}.py` | Pydantic models + enums: `Airport` (600+ IATA), `Airline`, `TripType`, `SeatType`, `SortBy`, `MaxStops`, `EmissionsFilter`, `Currency`, `Alliance`; `FlightSearchFilters`, `DateSearchFilters`, `FlightSegment`, `FlightLeg`, `FlightResult`, `BookingOption`, `TimeRestrictions`, `PassengerInfo`, `LayoverRestrictions`, `Amenities` |
| **Core** | `fli/core/parsers.py`, `builders.py`, `airports.py`, `currency.py`, `links.py` | String→enum parsing, segment/time-restriction building, airport fuzzy lookup, price formatting, Google Flights URL construction — **shared by CLI and MCP** so both parse parameters identically |
| **Search** | `fli/search/{client,flights,dates}.py` + private `_proto.py`, `_wire.py`, `_decoders.py`, `_concurrency.py`, `_helpers.py`, `exceptions.py` | HTTP client, the two search classes, protobuf token encoding, JSONP response decoding, thread-pool parallelism |
| **CLI** | `fli/cli/main.py`, `commands/{flights,dates,multi,airports}.py` | Typer app; bare args auto-route to the `flights` subcommand; Rich tables + `--json` mode |
| **MCP** | `fli/mcp/server.py`, `_entry.py` | FastMCP server; STDIO (`fli-mcp`) and HTTP (`fli-mcp-http`) transports |

### 3.2 Search data flow (end-to-end)

```
FlightSearchFilters (Pydantic)
  → .format()  — nested list matching Google's protobuf-ish shape
  → .encode()  — json.dumps + urllib quote → POST body `f.req=…`
  → Client POST https://www.google.com/_/FlightsFrontendUi/data/
        travel.frontend.flights.FlightsFrontendService/GetShoppingResults
  → response is JSONP: )]}'  prefix + length-delimited `wrb.fr` chunks
  → fli/search/_wire.py iter_wrb_chunks() → JSON payloads
  → fli/search/_decoders.py parse_flight_row() → FlightLeg / layovers / emissions
  → list[FlightResult]   (round trips: _expand_multi_leg() re-POSTs per outbound,
                          fanned out via parallel_map() ThreadPoolExecutor)
```

Three Google endpoints are used: `GetShoppingResults` (flights for a date),
`GetCalendarGraph` (cheapest dates in a range — `SearchDates`), and `GetBookingResults`
(vendor fares for one itinerary — `SearchFlights.get_booking_options`).

Two protobuf tokens are hand-encoded in `fli/search/_proto.py` (varint + length-delimited
fields, base64):

- **booking token** — session-anchored, sent to `GetBookingResults`; falls back to the per-row
  token captured at parse time when the session token can't be built.
- **`tfs` deep-link token** — deterministic (no session), URL-safe base64; powers the per-flight
  `booking_url` returned by the MCP tools so the same itinerary always yields the same URL.

### 3.3 HTTP client (`fli/search/client.py`)

- `curl_cffi` session with `impersonate="chrome"` (TLS fingerprinting), one session **per thread**
  via `threading.local()`; process-wide singleton via double-checked `get_client()`.
- `TokenBucketRateLimiter(10 req/s)` shared across all threads — acquired before every request.
- `tenacity` retries: 3 attempts, exponential backoff; errors wrapped in a typed hierarchy
  (`SearchClientError` → `SearchTimeoutError` / `SearchConnectionError` / `SearchHTTPError` /
  `SearchParseError`).
- Timeout 60 s default, overridable via `FLI_TIMEOUT`.

### 3.4 MCP server (`fli/mcp/server.py`)

FastMCP server exposing **4 tools** — `search_flights`, `search_dates`, `get_booking_options`,
`find_airports` — plus 2 prompt templates and a `resource://fli-mcp/configuration` resource.
Industry-standard parameter names (`origin`, `destination`, `cabin_class`, `max_stops`); locale
knobs `currency`/`language`/`country` map to Google's `curr=`/`hl=`/`gl=`. Defaults configurable
via `FLI_MCP_*` env vars. Every flight result carries its own deterministic `tfs` booking URL;
`get_booking_options` re-runs the search, matches the itinerary by `flight_numbers` (bare `178`
or prefixed `BA178`), then fetches vendor fares. Errors return `{"success": false, "error": …}`.

### 3.5 Conventions in fli

- Python 3.10+ unions (`X | None`), full type hints, Google-style docstrings.
- Pure-data parsing layer with defensive accessors (`safe_get`, tri-state bools) — malformed
  rows degrade gracefully instead of raising.
- Threads, not asyncio (curl_cffi is sync); the rate limiter is the only shared mutable state.
- Enum quirk: digit-leading IATA codes are underscore-prefixed (`Airline._3F`) and the underscore
  is stripped on the wire.

---

## 4. Subsystem: `fli-js/` — TypeScript port

A deliberate **1:1 port** of the Python library, npm package `fli-js` (v0.0.4), ESM-only,
built with plain `tsc` (no bundler), Bun for dev/test.

- **Same module shape**: `src/core/`, `src/models/`, `src/search/` mirror the Python layout;
  function and variable names match upstream.
- **Wire compatibility is tested**: `tests/integration/filter_format_snapshots.test.ts` asserts
  filter encoding is byte-identical to Python; `tests/search/proto.test.ts` asserts
  `buildBookingToken`/`buildTfsToken` produce byte-for-byte identical tokens.
- **Key divergence**: no curl_cffi equivalent in JS — `src/search/client.ts` uses native `fetch`
  with a realistic Chrome UA + `Sec-CH-*` headers instead of TLS impersonation. Same token-bucket
  rate limiting (10 req/s), 3 retries with exponential backoff, `HTTPS_PROXY` support,
  `FLI_TIMEOUT` env var.
- **Codegen**: `scripts/generate-enums.ts` regenerates `src/models/airport.ts` (~15.8k lines) and
  `airline.ts` (~2.2k lines) from the shared `data/*.csv`; CI fails if generated output drifts.
- **Validation**: Zod schemas mirror the Pydantic validators (e.g. `TimeRestrictionsSchema` swaps
  reversed earliest/latest).
- **Tooling**: Biome (format+lint) + oxlint, TS `strict` with `noUncheckedIndexedAccess`,
  `bun:test` with stubbed-network integration tests; live e2e gated behind `FLI_E2E=1`.
- No CLI and no MCP server — library only.

---

## 5. Subsystem: `skrendam/` — the deal engine

### 5.1 Module map

| Module | Responsibility |
|---|---|
| `skrendam/cli.py` | `skrendam` command: `run-scan`, `seed`, `calibrate`, `worker`, `analyze` |
| `skrendam/config.py` | pydantic-settings, `SKRENDAM_*` env prefix (database_url, pacing, locale EUR/lt/LT, circuit breaker) |
| `skrendam/scheduler.py` | APScheduler `BlockingScheduler`, cron daily **06:00 Europe/Vilnius** (`scheduler.py:9-10`) |
| `skrendam/worker.py` | Polls `scan_requests` every ~15 s, processes up to 5 queued jobs (`full_scan` / `recheck`); errors recorded per-request, never abort the batch |
| `skrendam/analyze.py` | Read-only tuning stats: discount distributions, tier preview (great ≥ 0.88) vs the dev DB |
| `skrendam/calibrate.py` | Seeds `Zone.threshold_price_eur` from 10th-percentile scans across each zone's routes |
| `skrendam/seeds.py` | Idempotent starter config: Zones, Routes, AudienceSegments, TravelMoments, DealTemplates |
| `skrendam/verification.py` | Recheck pipeline: re-verify availability, set `going_fast` (price ≥ published × 1.05), expire `PublishedDeal`s |
| `skrendam/db/{base,session,models,repositories}.py` | SQLAlchemy 2.0 declarative models + upsert-via-select repositories (SQLite/Postgres compatible) |
| `skrendam/scanning/orchestrator.py` | The 11-step scan loop (below) |
| `skrendam/scanning/{types,resolver,baseline,matching,content,dedup}.py` | Pure logic, zero I/O: frozen dataclasses, template→SearchSpec expansion, percentile baselines, 3-gate scoring, draft generation, dedup keys |
| `skrendam/fli_adapter/{adapter,live_backend,pacing,errors}.py` | The **only** seam to fli: builds fli filters, calls `SearchDates`/`SearchFlights`, classifies errors, paces calls |

### 5.2 The scan pipeline (`orchestrator.py: run_scan`)

1. **Resolve** — each enabled `DealTemplate` × matching `Route`s → `SearchSpec`s
   (relative/seasonal/fixed date windows, clipped to 305 days out).
2. **Calendar search** — `FliAdapter.search_calendar()` → fli `SearchDates` (cached per spec).
3. **Baseline** — `compute_baseline()`: min / median / 10th-percentile over calendar points.
4. **Flag cheap dates** — points with price ≤ decile (naturally bounds detail fetches to ~10%).
5. **PriceLog** — every calendar point persisted for later tuning analysis.
6. **Detail search** — flagged dates → fli `SearchFlights` → `FareItinerary` (min-price fare).
7. **Discount** — `(baseline.median − fare.price) / baseline.median`.
8. **Match** — `matching.match(fare, template, baseline, zone)` per applicable template.
9. **Upsert Candidate** — dedup by `deal_group_key(origin, dest, trip_type, dates, €5 price band)`;
   re-finds update price/last_seen but **never overwrite curator decisions**.
10. **Persist matches + auto-draft content** — `CandidateTemplateMatch` + `ContentDraft` filled
    from template patterns (`{origin}`, `{price}`, …), no overwrite of curator edits.
11. **Expire** — candidates still `new/seen/maybe` past their 14-day TTL → `expired`.

### 5.3 Matching & scoring (`skrendam/scanning/matching.py`)

- **Gate 1 (hard) price anomaly** — discount ≥ template `min_discount_pct`, or price under the
  template/zone ceiling, or under the psychological threshold. Fail → no match.
- **Gate 2 (hard) itinerary sanity** — max stops, max duration, self-transfer / mixed-cabin /
  airport-change / overnight-layover allowances. Fail → no match.
- **Gate 3 (soft) marketability** — absolute savings floor; informs the score only.
- **Score** (0–1): `0.50·anomaly + 0.20·itinerary + 0.15·bookability + 0.15·urgency`
  (`matching.py:15`). Emitted only if `score ≥ SEND_THRESHOLD (0.55)` **and** the anomaly is
  strong on its own (discount ≥ template floor, else `STRONG_ANOMALY_DISCOUNT = 0.20`).
- **Tiering**: the admin displays scores 0–100; ≥ **88** = "great" tier, else "maybe"
  (`web/src/lib/tiers.ts:5 GREAT_THRESHOLD`, mirrored as 0.88 in `skrendam/analyze.py:52`).

### 5.4 Pacing (`skrendam/fli_adapter/pacing.py`)

The engine paces itself far below fli's built-in 10 req/s: TokenBucket with
`min_call_interval_seconds = 1.5` (+ 0.5 s jitter) ≈ 0.67 req/s, plus a CircuitBreaker that
pauses the run after 5 consecutive failures. Calendar results are cached per spec within a run;
`ScanRun.api_calls` and `http_429s` audit the budget.

---

## 6. The shared database (the central contract)

**Source of truth**: SQLAlchemy models in `skrendam/db/models.py`, migrated by Alembic
(`alembic/versions/`: `0001_initial`, `0002_scan_requests`, `0003_published_deal_going_fast`,
`0004_subscribers`, `adb4f0192c7e` early-alerts/confirm columns). Both Next.js apps consume the
same Neon Postgres via **Drizzle ORM with introspected (generated) schemas**
(`web/src/db/generated/`, `site/src/db/generated/`, refreshed with `npm run db:pull`).

| Table | Role | Key state machine / fields |
|---|---|---|
| `zones` | Price-threshold fallbacks per geographic zone | `threshold_price_eur`, `min_abs_savings_eur`, `min_discount_pct` |
| `routes` | Scannable origin→destination pairs | `enabled`, `cabin`, FK zone |
| `audience_segments`, `travel_moments` | Targeting/content dimensions for templates | slugs, tolerance, moment_type |
| `deal_templates` | The rules engine: 40+ fields of date windows, route filters, price/itinerary gates, content patterns | `enabled`, `trip_type`, `date_window_type` |
| `scan_runs` | Audit per scan: api_calls, 429s, candidates_found, errors | `running/completed/failed` |
| `price_log` | Every calendar point ever seen (tuning/sparklines) | run + route FK |
| `candidates` | A cheap fare found by the engine | **`new → seen → maybe → approved/edited/rejected → expired`**; unique `deal_group_key`; 14-day `expires_at` |
| `candidate_template_matches` | Score per (candidate, template) | `match_score`, `reason_text`, `gate_results` JSON. ⚠️ No composite unique constraint yet — both Next.js apps dedupe in code |
| `verification_checks` | Recheck audit (provider "fli") | price, available, booking_url, raw snapshot |
| `content_drafts` | Curator-editable copy per (candidate, template) | `draft/approved/published` |
| `published_deals` | What the public site shows | `status live/expired`, `going_fast`, `tier` (currently hardcoded `free`), `booking_url`, `valid_until` |
| `subscribers` | Email signups from the site | `confirmed`, `confirm_token`, `early_alerts`, `prefs` JSON |
| `scan_requests` | **The web→worker job queue** | `kind full_scan/recheck`; `queued → running → done/error` |

---

## 7. Subsystem: `web/` — curator admin (Deal Desk)

**Stack**: Next.js 16.2.7 (App Router, React 19), Drizzle ORM 0.45 + `@neondatabase/serverless`,
NextAuth v5 beta (single admin, credentials + bcrypt), Zod, Lucide icons, Vitest + Playwright.
Dev port 3000. **No Tailwind** — Yip design-system CSS variables.

**Routes** (`web/src/app/`): `/` dashboard (queue stats, scan health), `/queue` (tiered curator
queue), `/candidates/[id]` (review detail), `/published` (live/expire/republish),
`/scans` (run history + pending requests), `/login`, and `/config` hub with the **five config
editors** — `/config/zones`, `/config/routes`, `/config/templates`, `/config/audiences`,
`/config/moments` — each a thin CRUD form over the corresponding engine table (server actions in
`src/app/config-actions.ts`, enum validation before write).

**Curator workflow**: `getQueueRows()` joins matches+candidates+templates+drafts, sorts by score,
splits at `GREAT_THRESHOLD = 88` into great/maybe tiers → Composer drawer (copy drafting with
char counts, verification status, price-vs-baseline) → server actions in `src/app/actions.ts`:
`setCandidateStatus()`, `saveContentDraft()`, `publishDeal()` (inserts the `published_deals` row —
*inserting that row is the publish*; the public site picks it up by query), `expireDeal()` /
`republishDeal()`.

**Worker delegation**: the admin **never calls fli**. Buttons enqueue rows —
`enqueueScan()` → `scan_requests(kind='full_scan')`, `enqueueRecheck(candidateId)`,
`enqueueRecheckLive()` (one recheck per live deal) — and the Python worker polls them. Status is
read back on page load (no streaming/polling UI).

**Auth**: NextAuth credentials provider; `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (bcrypt) env
vars; JWT sessions; middleware redirect in `src/proxy.ts` plus a `requireAdmin()` guard inside
every server action.

**Patterns**: server components for reads, client components for interactivity;
mappers (`toCandidateView` etc.) translate DB rows → display models; `revalidatePath()` after
mutations; Next 16 awaited `params` (Promises); unit tests for `lib/{format,status,tiers,mappers}`,
Playwright journey e2e.

---

## 8. Subsystem: `site/` — public site

**Stack**: Next.js 16.2.7, Drizzle + Neon, **Resend** 6.12 (email), Zod, Vitest + Playwright.
Dev port 3001. Same design-token approach (no Tailwind). Current branch is the Spec 2.1 CRO/SEO/GEO
redesign (open PR #5).

**Routes** (`site/src/app/`):

| Route | Purpose |
|---|---|
| `/` | Homepage: hero + signup card, live deals as boarding-pass tickets, past-fares proof, collections grid, FAQ, sticky CTA |
| `/deal/[id]` | Deal detail: photo hero, price block, "why it's good / the catch" (`lib/dealDetail.ts`), curator note, 90-day price sparkline (`lib/priceContext.ts` over `price_log`), similar deals, email nudge, booking CTA. `noindex` unless status `live` |
| `/[slug]` | Six hardcoded SEO collections (`lib/collections.ts`): e.g. `cheap-flights-from-vilnius`, `september-sun-deals` — filter by origin / zone / travel moment; `generateStaticParams` + 404 for unknown slugs |
| `/collections`, `/past-deals` | Collection index; expired-deals archive (proof of quality) |
| `/subscribe` | Signup state machine (below) |
| `/early-alerts` | Free-vs-early comparison landing + join form |
| `/confirm` | GET route handler: token → mark confirmed, set cookie, redirect (`force-dynamic`) |
| `/robots.txt`, `/sitemap.xml` | Metadata routes (below) |

**Data access** (`site/src/lib/queries.ts`): read-only over `published_deals` (+ candidate
itinerary snapshots + match scores), `revalidate = 300` ISR everywhere content-bearing.
Live pages filter `status='live'`; `/past-deals` uses `status='expired'`. Because
`candidate_template_matches` can fan out joins, every query **dedupes by deal id before applying
limits** (`dedupeById()` — the dedupe-before-limit fix from commit `906fd79`).

**Signup flow** (`site/src/app/subscribe-action.ts`, single `'use server'` module):

```
email submit
 ├─ RESEND_API_KEY set  → double opt-in: insert unconfirmed row + 48-hex-char token
 │     (onConflictDoUpdate gated to unconfirmed rows only) → Resend confirm email
 │     → /subscribe?state=check-email … user clicks /confirm?token=…
 └─ key absent (dev)    → single opt-in: row confirmed immediately
both → httpOnly cookie `yip_pt` (1 h, path=/subscribe) → state=confirmed
     → optional prefs (origin/moment allowlists in lib/subscribe-prefs.ts) → prefs-saved
     → early-alerts upsell → joinEarlyAlertsAction sets early_alerts, NULLs the token,
       deletes the cookie → early-joined
```

Tokens are `randomBytes(24).hex()`, single-use, never exposed in the page URL after confirm;
confirmed rows are immutable from the public endpoint. Email sending is a no-op until
`RESEND_API_KEY` exists (`lib/email.ts emailEnabled()`); from-address `YIP_FROM_EMAIL`.

**SEO/GEO** (`lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts`): Organization / WebSite /
BreadcrumbList / Article JSON-LD — deliberately **no Offer/price markup**; robots welcomes AI
crawlers by name (GPTBot, ClaudeBot, PerplexityBot, …) and disallows only `/confirm`; sitemap
includes static routes, the six collections, and **live deals only**; `metadataBase` from
`NEXT_PUBLIC_SITE_URL`.

**Booking handoff** (`lib/booking.ts`): v1 always hands off to Google Flights via the
engine-provided `published_deals.booking_url` (tfs deep link), with protocol-validated URLs and a
Google Flights home fallback; `airline`/`ota` CTA kinds are stubbed for the future vendor-direct
flow (fli `get_booking_options`).

**Tests**: Vitest unit tests across `lib/` (mappers, quality thresholds 88/94, seo, subscribe,
dealDetail, collections); Playwright e2e including `e2e/journey-capture.spec.ts` — a 5-journey,
41-step storyboard that screenshots every step into `e2e/journey-shots/` and generates a
`journey-map.html`, tolerating both opt-in modes.

---

## 9. Cross-system data flows

**A. Deal lifecycle (the main product flow)**

```
Google Flights ──fli──▶ skrendam scan (06:00 daily or curator-enqueued)
  ─▶ candidates + matches + auto content_drafts            [engine writes]
  ─▶ web/ queue (great ≥88 / maybe) → curator review/edit  [admin reads/writes]
  ─▶ publishDeal() inserts published_deals status=live      [admin writes]
  ─▶ site/ homepage & collections render it (ISR ≤5 min)    [site reads]
  ─▶ worker rechecks → going_fast flag or status=expired    [engine writes]
  ─▶ expired deals move to /past-deals, drop from sitemap   [site reads]
```

**B. Work-request queue (web → engine)** — `scan_requests` table is the RPC substitute:
admin inserts `queued` rows; `skrendam worker` polls every ~15 s, flips them
`running → done/error` with a `result_summary` JSON; the admin reads status on refresh.

**C. Subscriber flow (site → DB → Resend)** — described in §8; the engine's `subscribers`
table is written only by the site. (Deal-email *sending* — newsletters/alerts — has template
fields and tags in the schema but no sending engine in the repo yet.)

**D. Release flows** — fully independent per package, both `workflow_dispatch`-driven with
`dry_run`: PyPI tags `vX.Y.Z` (`release.yml`); npm tags `fli-js-vX.Y.Z` (`release-npm.yml`).
Both funnel through `scripts/bump_version.py` (stdlib-only; `--pyproject` / `--package-json` /
`--tag-prefix`; covered by `tests/scripts/test_bump_version.py`).

---

## 10. External integration points

| External | Used by | Notes |
|---|---|---|
| **Google Flights private API** | `fli` / `fli-js` | `GetShoppingResults`, `GetCalendarGraph`, `GetBookingResults`; browser impersonation; 10 req/s self-limit |
| **Neon Postgres** | skrendam (SQLAlchemy), web + site (Drizzle/`@neondatabase/serverless`) | `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (drizzle-kit pull); skrendam env `SKRENDAM_DATABASE_URL` (defaults to in-memory SQLite for tests) |
| **Resend** | site | Confirm emails only; hard-gated on `RESEND_API_KEY` |
| **PyPI** | release.yml | Trusted Publishing (OIDC); publish steps inlined because attestations break in reusable workflows |
| **npm** | publish-npm.yml | `--provenance --access public` |
| **GHCR** | docker.yml | `ghcr.io/<repo>` multi-arch (amd64/arm64) image of the MCP HTTP server |
| **Railway** | `railway.toml` + `nixpacks.toml` | Deploys `fli-mcp-http` (Python 3.12 via uv, sleep-enabled, port 8000); config smoke-tested in CI |
| **GitHub Pages** | docs.yml | MkDocs Material site from `docs/` → `_docs_build/` |
| **Google Fonts** | web, site | Bricolage Grotesque / Hanken Grotesk / Space Mono |

(The Next.js apps' hosting target is not declared in-repo — no vercel.json or equivalent.)

---

## 11. CI/CD overview (`.github/workflows/`)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push/PR to main, callable | Path-filtered jobs: ruff lint; fli-js Biome+oxlint+typecheck; fli-js tests + **generated-enum sync check**; Python test matrix 3.10–3.13 (`pytest --all --ignore=tests/search/` — live-API tests excluded); Railway/Nixpacks config smoke test; junit aggregation to PR |
| `release.yml` | manual | bump → notes → commit+tag `vX.Y.Z` (4-attempt push retry) → GitHub Release → test → PyPI |
| `publish.yml` | release published / manual | Fallback PyPI publisher; skips `fli-js-v*` tags |
| `release-npm.yml` | manual | Same shape for `fli-js/package.json`, tag `fli-js-vX.Y.Z`, notes scoped to `fli-js/` + `data/` |
| `publish-npm.yml` | called / release | bun test → tsc build → tarball validation → npm publish with provenance |
| `docker.yml` | push main / release | GHCR multi-arch image |
| `docs.yml` | push main | MkDocs → GitHub Pages |
| (`actionlint` job) | workflow changes | Validates the YAML itself |

---

## 12. Dev environment & tooling

- **Python**: `uv sync --all-extras`; extras = `mcp`, `skrendam`, `dev`, `all`. `make test` /
  `test-fuzz` / `test-all` / `lint` / `format`; tox for the 3.10–3.13 matrix; act (`make ci`,
  `.actrc`) for local GHA; `.devcontainer/` with uv + act preinstalled.
- **pytest markers** (`pytest.ini`): `fuzz` (needs `--fuzz`), `parallel` (xdist); skrendam tests
  use in-memory SQLite fixtures; live-network tests (`tests/search/`, `test_e2e_live.py`) are
  opt-in.
- **fli-js**: `bun install`; `bun run ci` = format-check + lint + typecheck + test;
  `bun run generate:enums` after touching `data/*.csv`.
- **web / site**: plain npm; `npm run dev` (3000 / 3001), `npm run db:pull` to re-introspect the
  Drizzle schema after a migration; `.env.example` in each app.
- **Ruff**: line length 100, py310 target, rules E/F/I/B/C4/UP/D (Google docstrings; D203/D213
  ignored); relaxed for tests/examples.

---

## 13. Patterns & conventions (repo-wide)

1. **Database-as-API** — the three Skrendam components share Postgres tables instead of HTTP
   APIs; `scan_requests` is a polled job queue. Schema authority lives in SQLAlchemy + Alembic;
   Drizzle schemas are *generated* downstream copies.
2. **Pure-core, impure-edges (engine)** — `scanning/{resolver,baseline,matching,content,dedup}`
   are pure functions over frozen dataclasses; all I/O lives in the adapter, repositories, and
   orchestrator. Makes the pipeline testable offline with a fake backend.
3. **Adapter seam over fli** — `skrendam/fli_adapter/` is the only place that imports fli, by
   design ("swappable before going paid").
4. **Curator-decision preservation** — every engine upsert is select-then-write and refuses to
   overwrite statuses/edits a human made.
5. **Shared parsing core (fli)** — CLI and MCP both call `fli/core` so parameters behave
   identically; fli-js replicates the same core 1:1 with snapshot tests enforcing wire parity.
6. **Defensive decoding** — Google responses are tree-walked with `safe_get`-style accessors;
   unknown shapes degrade, never crash.
7. **Yip design system everywhere** — no Tailwind; CSS custom properties
   (`site/src/styles/colors_and_type.css`: amber/sea/coral/sand palette, 4 px spacing grid,
   warm shadows) scoped under `.yip-site`; boarding-pass `DealTicket` is the signature component;
   HTML mockups in `site/src/design-reference/` are the layout source of truth; the
   `.claude/skills/yip-design-system` skill governs all UI/copy work.
8. **Dedupe-before-limit** — any query joining through `candidate_template_matches` must dedupe
   by deal id *before* slicing (no composite unique constraint yet).
9. **`'use server'` purity** — server-action modules export only async actions; re-exporting pure
   helpers corrupts the server-reference manifest and 404s form posts (fixed in `e8de641`; helpers
   live in `lib/` instead).
10. **Typed errors at every boundary** — fli's `SearchClientError` hierarchy; the engine's
    `ScanError` classification; MCP's `{success:false}` envelopes; worker never lets one job kill
    a batch.
11. **Conservative upstream etiquette** — fli enforces 10 req/s, but the engine paces at
    ~0.67 req/s with jitter + circuit breaker, and CI skips live-API tests.

---

## 14. Known gotchas & drift risks

- **Schema drift**: Drizzle schemas in `web/` and `site/` are introspected snapshots — run
  `npm run db:pull` in both apps after any Alembic migration.
- **`candidate_template_matches`** lacks a composite unique constraint (deferred migration);
  rely on code-level dedupe until added.
- **`.env` bcrypt hashes**: `ADMIN_PASSWORD_HASH` contains `$` — must be escaped as `\$`
  (dotenv-expand interpolation). skrendam's pydantic-settings is unaffected.
- **Live-API tests** (`tests/search/`, `tests/skrendam/test_e2e_live.py`, fli-js `FLI_E2E=1`)
  hit Google Flights and rate-limit easily; they are excluded from CI on purpose.
- **Next 16 specifics**: route `params` are Promises (must `await`); Turbopack server-action
  manifest is sensitive to non-async exports from `'use server'` modules.
- **Email is off by default**: without `RESEND_API_KEY` the signup silently becomes single
  opt-in — correct for dev, but production needs the key set.
- **Score scale duality**: the engine scores 0–1 (send ≥ 0.55), the UI/DB tier threshold is
  expressed as 88 on a 0–100 scale; `web/src/lib/tiers.ts` and `skrendam/analyze.py` must stay
  in sync (comments in both point at each other).
- **`tier` on `published_deals`** is hardcoded `free` — the tiered-release product mechanic
  (Spec 3 / Pro) is schema-ready but not implemented.

## 15. Glossary

| Term | Meaning |
|---|---|
| **Candidate** | A cheap fare the engine found, awaiting curation (14-day TTL) |
| **Deal template** | Curator-authored rule set that defines what counts as a deal and how to write it up |
| **Zone** | Geographic grouping carrying fallback price thresholds (calibrated from scans) |
| **Travel moment / audience** | Content/targeting dimensions attached to templates (e.g. September sun) |
| **Baseline** | Median/decile price over a template's calendar window; discounts are relative to it |
| **Great / maybe tier** | Queue split at match score 88 (0–100) |
| **going_fast** | Recheck found the price ≥ 5% above the published price |
| **tfs token** | Deterministic protobuf deep-link token to a specific Google Flights itinerary |
| **Opportunity inbox** | The public site's framing: a small, curated, expiring set of deals |
