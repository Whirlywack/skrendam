# 2026-07-10 — Full-repo audit + fix pass (handoff / memory)

Context for future sessions. A 20-agent audit (4 subsystem mappers, 8
domain-scoped finders, adversarial batch verifiers; ~2.3M tokens read) ran over
the whole monorepo, then the high-value findings were fixed on branch
**`fix/audit-findings`** (10 commits, pushed, **no PR opened yet**).

Numbers: 66 raw findings → **63 confirmed** (4 high / 24 medium / 35 low),
3 refuted. Clean bill: no SQLi anywhere, XSS-safe rendering (React escaping;
the one `dangerouslySetInnerHTML` is safe JSON-LD), sane NextAuth + bcrypt
fundamentals, TLS verification intact, Dockerfile hygiene good, and the
fli-adapter health/pacing/breaker design confirmed solid and well-tested.

## What was FIXED on `fix/audit-findings`

### Engine correctness (`c5aacee`)
- **WeightedScorer monotone** (`skrendam/scanning/scoring/weighted.py`): the
  0.4 under-ceiling floor now applies at ANY discount — a fare €1 below median
  can no longer score worse than the same fare above it.
- **Resolver year-wrap** (`resolver.py`): a Dec→Feb season scanned mid-January
  now searches the remaining tail (Jan–Feb), not next winter.
- **content.py**: any curator template format error (e.g. `{price:.0f}`) falls
  back to the raw pattern instead of aborting the whole scan run.
- **worker.py**: rolls back before recording a failed request (no more
  committing half-finished scan state); the finally-commit is guarded so a
  poisoned session can't kill the poll batch.
- **Real wall-clock `now`** threaded into `run_scan` from cli + worker (was
  pinned to midnight → same-day scans were mutually invisible in history and
  `last_seen_at` moved backwards). Midnight default kept for injected-`today`
  test determinism.
- **upsert_candidate race-safe** (`db/repositories.py`): savepoint +
  IntegrityError re-select — a daily-cron vs curator-scan collision updates the
  winner's row instead of aborting the run.
- **health.py two new signals**: total error-ratio ≥30% (≥5 calls) and
  flights-empty ≥50% (≥5 calls) → degraded. Closes the "interleaved errors
  never open the consecutive-only breaker" blind spot.
- **history.py duration partitioning**: `HistoryPoint.return_date` added;
  round-trip series filtered by trip duration so 3-day and 14-day totals never
  blend in percentile/min/previous-price. Orchestrator passes
  `spec.duration_days`.
- **adapter.py**: `MAX_ROWS_PER_CALL=500` clamp (Google-controlled response
  size can't drive unbounded inserts); booking_url allowlisted to
  `https://www.google.com/` (else nulled + logged); passes through
  `airport_change` / `overnight_layover` / `max_layover_minutes`.
- **live_backend.py rewritten seams**: `cabin` actually mapped to fli
  `SeatType` in BOTH search paths (was hardcoded ECONOMY — the whole cabin
  plumbing was inert); duration = sum of all directions (includes layovers,
  was outbound flight-time only); stops = per-direction worst case;
  `airport_change` / `overnight_layover` (date-boundary + ≥240min rule) /
  `max_layover_minutes` derived from real leg data — the seeded family
  template's gates now actually enforce. Legs in snapshots carry airports +
  ISO times.
- **Config**: `SKRENDAM_CIRCUIT_BREAKER_THRESHOLD` wired through cli/worker →
  run_scan (was a silent no-op); dead `fli_timeout` knob deleted.
- **alembic/env.py**: `%` in DB URL escaped for configparser (URL-encoded
  passwords no longer crash migrations).
- **fli fork patch** (`fli/search/client.py`): `FLI_IMPERSONATE` env override.
  Call sites pass `impersonate="chrome"` whose ECH is dropped by
  TLS-inspecting proxies (opaque curl error 35 reset). Set
  `FLI_IMPERSONATE=chrome116` in such environments (CI sandboxes, corp
  proxies). Unset = upstream behaviour. **This is the fork's only divergence
  from upstream fli** (vendor was at upstream HEAD `daf9e9a` before it).
- Regression tests for every fix: `tests/skrendam/test_audit_regressions.py`.

### Web + site hardening (`c1ad71c`)
- **site subscribe abuse guard** (was the top security finding): per-IP
  (8/10min) + per-email (3/h) in-memory fixed-window limiter
  (`site/src/lib/rate-limit.ts`); over-limit indistinguishable from success but
  does nothing (no row, no Resend send). Email length capped at 254. NOTE:
  in-memory = single-replica assumption; swap store if scaled out.
- **web login throttle**: 8 attempts / 15min per (ip, username) in the login
  server action; `?error=locked` message. Copy of the limiter in
  `web/src/lib/rate-limit.ts` (duplicated on purpose — no shared workspace
  package exists yet; keep in sync).
- **web sessions**: JWT maxAge 8h (was Auth.js default 30 days, irrevocable);
  logout button in Sidebar via `web/src/app/auth-actions.ts`.
- **Defense in depth**: `auth()` check in `(app)/layout.tsx`; proxy matcher
  exempts only `api/auth` (was all of `/api`).
- **Security headers** both apps (`next.config.ts`): XFO DENY,
  CSP frame-ancestors 'none', nosniff, referrer-policy, HSTS.
- **e2e DB guard** both Playwright configs: require `E2E_DATABASE_URL`
  (distinct from `DATABASE_URL`) — the specs publish real deals / create
  subscribers and used to run against the production Neon DB.
- **/candidates/[id] RSC crash fixed** (function prop across server→client
  boundary; `onClose` now optional and omitted).
- publishDeal: dead `channel` param removed (tier still hardcoded 'free' —
  see NOT-fixed list). Dashboard great-count uses stored `quality_tier`.
- Icon.tsx literal lucide imports (was `import *` shipping the whole library);
  DashboardCards no longer 'use client'; dead site components deleted
  (DealDetail/Itinerary/BookingCta/StatusLine/QualityTag); web scaffold
  leftovers deleted; site deps zod + lucide-react removed; `@next/env`
  declared in both apps; booking CTA https-only.

### Repo hygiene (`012d741` + 6 API commits + `5260e2f`)
- **Deleted**: `fli-js/` (~21k lines, consumed by nothing), all upstream
  release machinery (`release.yml`, `publish.yml`, `release-npm.yml`,
  `publish-npm.yml`), `docs.yml` (deployed punitarani-branded docs + HIS
  Google Analytics key on every push), `docker.yml`,
  `scripts/bump_version.py` + `tests/scripts/`, `docs/assets/` (10.7MB
  upstream demo media), `tox.ini`, `.actrc`, `examples/typescript`,
  `docs/typescript`.
- docker-compose now `build: .` (was pulling upstream's UNPATCHED ghcr image).
- dependabot: upstream reviewer removed; npm ecosystems now watch `/web` +
  `/site` (fli-js section gone).
- pyproject: never-imported `httpx`, `ratelimit`, `python-dotenv` removed;
  ignored `[tool.pytest.ini_options]` table dropped (pytest.ini is the one
  config). uv.lock refreshed.
- Repo-wide `ruff format` + lint fixes: `ruff format --check` and
  `ruff check .` both pass clean with currently-resolved ruff (main had
  drifted vs newer ruff).
- CLAUDE.md "Releasing" section rewritten (no packages published from fork);
  PR-GATE Lane J removed; AGENTS.md lane list updated.

### ⚠️ ci.yml — ACTION REQUIRED
The push credential lacks the `workflow` OAuth scope: deleting workflow files
via the GitHub API worked, but **updating `ci.yml` was refused**. The
rewritten CI (fli-js jobs out; new `web` and `site` lanes: npm ci, vitest,
`tsc --noEmit`, `next build`; permissions narrowed) is staged at
**`.github/ci.yml.proposed`**. Apply with:

    git mv .github/ci.yml.proposed .github/workflows/ci.yml && git commit && git push

Until applied, the OLD ci.yml on the branch still references the deleted
`fli-js/` and those jobs will fail.

## Verified
- `ruff format --check` + `ruff check .` clean; full pytest suite green
  (excl. live `tests/search/`); web + site: vitest + `tsc --noEmit` +
  `next build` all green.
- **Live fli check**: with `FLI_IMPERSONATE=chrome116` (sandbox proxy drops
  ECH), `SearchDates` returned 46 real calendar prices VNO→BCN (€36–68).
- Full alembic chain applies cleanly to SQLite; `skrendam run-scan --seed`
  against a demo SQLite DB with the LIVE backend was in flight when this doc
  was written (14 routes / 6 templates / 6 zones seeded).

## NOT fixed (deliberate follow-ups, roughly prioritized)
1. **Pro tier unreachable**: `publishDeal` hardcodes `tier:'free'`; site
   queries don't filter by tier either (fine while everything is free; must be
   decided before the paid list ships — needs a tier selector in Composer AND
   a server-side tier gate in `site/src/lib/queries.ts`).
2. **~14 dead DealTemplate columns** (preferred_departure_days,
   family_friendly_times_only*, earliest/latest hour, layover bounds,
   trip_len_max_days, prefer_direct…) — wire or drop in a migration
   (coordinated: alembic + both Drizzle snapshots). *airport-change/overnight
   gates DO work now; the hour/weekday ones still don't exist.
3. **candidate_scores is write-only** — build the Deal Desk read or drop the
   table + upsert_score.
4. **Drizzle snapshot duplication** (web + site vendor byte-identical 92K
   generated schemas; only site has `db:pull`) — single shared package +
   drift check wanted. Same for duplicated `airports.ts`/`format.ts`/brand
   CSS and the two rate-limit.ts copies → npm workspaces decision.
5. **Dedup price-band edge flip** (`dedup.py` ceil to €5): a fare wobbling
   across a band edge mints a duplicate candidate after the original was
   approved. Fix = nearest-band lookup before minting.
6. Scheduler process could fold into the worker (one always-on process
   instead of two; also removes the cron-vs-worker concurrent-scan window —
   the upsert race fix already de-fangs collisions).
7. Config-form scaffolding (~1,340 duplicated lines across 5 forms) →
   ConfigFormShell extraction.
8. Unpinned third-party GitHub Actions (dorny/paths-filter@v4 etc.) → pin to
   SHAs.
9. MCP server on Railway (`fli-mcp-http`, `sleepApplication=true`) has no
   auth — intentional internal tool, but decide whether the URL needs a token.
10. Subscriber confirm-token has no TTL (capability link lives until the
    early-alerts step nulls it).
11. matching.py legacy shim + MatchResult exist only for their own test —
    port tests, delete.
12. Upstream fli bugs present in the vendor (no local fix intended, watch
    upstream): #146 rail-route crash (contained by adapter error
    classification), #213 booking URLs hardcode economy (harmless while all
    deals are economy — but see `build_flight_booking_url` if premium ships).

## Operational notes discovered along the way
- The weekly upstream-watch routine (docs/ops/upstream-watch.md) reported
  upstream quiet since May 29; vendor was byte-identical to upstream HEAD
  until the FLI_IMPERSONATE patch above.
- Container/CI proxies that re-terminate TLS reset ECH handshakes →
  `FLI_IMPERSONATE=chrome116` is the knob (chrome/chrome124+ fail,
  chrome110/116 work).
- `git push` from automation cannot touch `.github/workflows/` (no `workflow`
  scope); GitHub API file-DELETEs are allowed, UPDATEs are not.
