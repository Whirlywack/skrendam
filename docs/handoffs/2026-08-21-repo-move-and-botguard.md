# Handoff — repo move, scan revival, and the BotGuard finding

_Date: 2026-08-21. Written from `/Users/superoptimised/Skrendam` (note the new path).
Branch: `fix/audit-findings`. Read this before touching the engine._

---

## 0. The one-paragraph version

The daily scan had **never once run** — 72 consecutive launchd failures since 2026-06-12,
caused by macOS TCC blocking `~/Documents`. Fixed by moving the repo to `~/Skrendam`;
verified firing. But reviving the scan surfaced a much bigger problem: around **2026-08-07
Google added a BotGuard signature requirement** to the Flights RPCs, and `fli` cannot
produce it. We now get roughly **15% of the data we used to**. The engine, the site, the
admin and the health detection all work correctly — the *data supply* is what broke.

---

## 1. What this product is (for whoever reads this cold)

Skrendam/Yip is a **curated flight-deal newsletter** for the Baltics — a robot proposes,
the founder disposes. Not a search engine.

```
SCAN (robot, daily 06:00) → SCORE (robot) → CURATE (founder) → PUBLISH → site + email
```

Three surfaces, **one shared Neon Postgres, no API between them** — the database *is* the
interface:

| Component | What it is | Port |
|---|---|---|
| `skrendam/` | Python engine. Scans via the vendored `fli` fork, scores, writes candidates | — |
| `web/` | "Deal Desk" — private admin. Review queue → Publish | 3000 |
| `site/` | "Yip" — public site. Reads `published_deals` only | 3001 |

Publishing **is** the insert: clicking Publish writes one `published_deals` row and the
site renders it within 5 minutes (ISR 300s). No deploy step.

**The scan is two-tier**, and this distinction matters for everything below:

- **Tier 1 — `GetCalendarGraph`.** "What does every day cost on this route?" One call per
  route×template window. All points → `price_log`. Cheap, broad.
- **Tier 2 — `GetShoppingResults`.** Only for dates in the **cheapest 10%**, fetches the real
  bookable itinerary. This is what becomes a candidate.

Four scorers run per fare — `weighted` (works from day one), plus `drop`, `error_fare`,
`rarity` which need **8–10 days of per-route history** before they fire.

---

## 2. What we did today

### 2.1 Diagnosed and fixed the TCC block (the 70-day outage)

A launchd probe settled it definitively:

```
A: read a file OUTSIDE ~/Documents  → OK
B: read a file INSIDE  ~/Documents  → DENIED
C: list ~/Documents/Skrendam        → DENIED
```

macOS TCC protects exactly `~/Documents`, `~/Desktop`, `~/Downloads`. A launchd-spawned
`/bin/bash` has no access and **no way to prompt for it** — so it failed silently, forever.

**Fix: moved the repo to `/Users/superoptimised/Skrendam`.** Chosen over granting Full Disk
Access to `/bin/bash` because it needs no security grant, is narrower, and survives macOS
updates.

Post-move steps that were required and are easy to miss:

1. `git worktree repair <path>` **per worktree** — the bare no-arg form does not fix them.
2. **`rm -rf .venv && uv sync --all-extras`** — every console script in `.venv/bin` hardcodes
   the old interpreter in its shebang. Symptom: `pytest` silently falls back to a Homebrew
   binary and everything fails with `ModuleNotFoundError: sqlalchemy`.
3. `scripts/install-daily-scan.sh` from the primary checkout (the plist hardcodes the path).
4. Copy `~/.claude/projects/<old-key>/` → `<new-key>` or the next agent session starts blind.

### 2.2 Verified the whole pipeline end to end

Kickstarted the job. It ran, and the DB confirms every stage worked:

| Stage | Evidence |
|---|---|
| launchd fires | 0 new errors in `launchd.err.log` (still 72, all historical) |
| Scan runs | `scan_runs` id 9 written |
| Tier-1 works | 154 `price_log` rows across 6 routes |
| Tier-2 works | 9 candidates with real itineraries (Ryanair FR1787 VNO→BCN €144, nonstop) |
| TTL sweep works | **377** stale candidates correctly expired |
| Curator safety works | the 1 `approved` candidate was **not** trampled |
| Health detection works | correctly flagged `degraded`, exit 2, reasons persisted |

**The resilience work (PR #7) proved itself.** It reported "this data is untrustworthy"
instead of silently claiming "no deals today."

### 2.3 Fixed four stale tests + pinned Python

The offline suite had been red. None were product bugs:

- `test_config.py` asserted `Settings.fli_timeout`, which the July audit deliberately deleted
  — the repo held **two contradictory tests** about it.
- `test_health.py::test_health_json_caps_error_detail` broke on the audit's new 30%
  error-ratio signal via an incidental `reasons == []` assertion.
- `test_live_backend.py` × 2 hardcoded `date(2026, 7, 1)`, now in the past, which fli's
  validator rejects. Made relative.
- **`.python-version` = 3.13** — Homebrew's `python3` is now 3.14, where `pydantic-core`
  fails to build, so a venv rebuild picks an unusable interpreter. Same content as the pin on
  `feat/route-expansion`, so no merge conflict.

Now: **518 passed, 2 skipped, 1 deselected.**

### 2.4 Tracked five documents that existed only in the working tree

The pilot research, deal-profiles discovery, the rework handoff, the pilot runbook and
codebase-research were **never committed**. One `git clean` would have destroyed the entire
pilot strategy. Now tracked, along with `site/e2e/journey-capture.spec.ts`;
`site/e2e/journey-shots/` is now gitignored.

---

## 3. The BotGuard finding — the thing that actually matters

### What we observed

The revived scan came back **degraded: 34/40 calendar searches returned no data**, price
rows 154 vs 1923 last run. A raw wire probe showed:

```
HTTP 200, 96 bytes
[["wrb.fr",null,null,null,null,[13]],["di",31],["af.httprm",30,...]]
              ↑ payload slot null      ↑ error 13
```

Six different TLS fingerprints (`chrome`, `chrome116`, `chrome131`, `chrome136`,
`firefox135`, `safari180`) all returned zero — **so this is not a TLS-fingerprint problem.**

### What upstream says (verified in raw issue comments, not summaries)

Two independent reporters on [fli#223](https://github.com/punitarani/fli/issues/223),
2026-08-08 and 2026-08-10, traced it: `GetShoppingResults` now requires an
**`X-Goog-BatchExecute-Bgr`** header generated by Google's own page JavaScript. Their
controlled tests found the header is *necessary and sufficient*, cookies irrelevant.

Critically, **a harvested token cannot be reused**: it is bound to the exact request bytes.
Same token + browser's own body → 81KB of data; same token + one date digit changed →
error 13. Their conclusion: *"fli's query builder can never produce a body Google accepts."*

**Upstream `fli` is abandoned** — last commit **2026-05-29**, ~3 months ago. Fix PRs (#224
et al) sit unmerged. Nobody is going to fix this for us.

### Where our data disagrees with upstream — read this carefully

Upstream calls the search path *"not recoverable in a plain HTTP client."* **Our evidence
says that is too absolute.** Today's scan produced 9 candidates carrying genuine tier-2
itineraries (real airlines, flight numbers, durations). Both endpoints still work — just
rarely.

The honest reading: **the gate is probabilistic, not absolute.** We get the residual
~15% pass rate that clients without a `bgr` token get. That matches our 6/40 exactly.

> **The product is degraded, not dead.** But at ~15% throughput, per-route history accrues
> ~6× slower, and three of four scorers need 8–10 points per route before they fire.

### What this does NOT mean

- ✗ Not a decoder break — a stale decoder would show a large body fli can't parse. We got 96 bytes.
- ✗ Not TLS fingerprinting — six profiles, identical failure.
- ✗ Not IP reputation *primarily* — our residential IP was clean in June and is ~85% gated now.
  The timeline tracks Google's change, not any IP change.
- ✗ **Not a stale vendored fork.** Our `fli/` sits at upstream `daf9e9a7`; the only later commit
  on upstream `main` is `121d34fe`, a TypeScript-only change to `fli-js` (which we deleted).
  There is nothing Python-side to pull.
- ✗ **Not the wrong fli surface.** CLI, MCP and library all funnel through the same
  `fli/search/client.py` and the same three RPCs. No surface can be less blocked than another.
  (There is no REPL; the CLI has exactly four commands: `airports`, `dates`, `flights`, `multi`.)

### Things investigated and ruled out (so nobody re-runs them)

| Hypothesis | Verdict | Evidence |
|---|---|---|
| Retrying the blocked call helps | **No** | 12 identical requests, 3s apart → **0/12**. The block is deterministic per request, not probabilistic per attempt. Upstream PRs #201/#205/#208 all retry; none would help. |
| Byte-vs-char chunk framing is eating our data | **No — refuted** | Upstream PR #224 claims Google's length header counts *characters* while `_wire.py:86` slices *bytes*, which would destroy any non-ASCII response (a real risk for Málaga/Köln/Zürich). Reproduced the failure synthetically — then tested the **7 real captured Google bodies** in `tests/search/fixtures/`: 6 contain multi-byte UTF-8 and **all decode correctly**. Google counts bytes. Our decoder is right. |
| `GetExploreDestinations` (PR #226) dodges the gate | **No** | Same `FlightsFrontendService` family, same `f.req` POST shape. PR #226's own author captured a live Explore rejection with the identical error-13 envelope. It would be a *volume* win (one call replaces N×M route calls), not a gate win. |
| An HTML-scrape fallback already exists | **No** | `Client.get` (`client.py:133`) is **dead code** — zero callers across `fli/`, `skrendam/`, `tests/`. |

### Untested leads worth ~an hour each

- **Force IPv4.** Upstream issue #200 (`MalcolmWardlaw`, 2026-07-13, reconfirmed 07-15) reports
  empty results "entirely fixed by forcing IPv4" via `CurlOpt.IPRESOLVE = 1` on the session.
  Single reporter, mechanism unexplained, ~5 lines, opt-in behind an env var like the existing
  `FLI_IMPERSONATE` hook. Cheap to A/B.
- **Proxy support.** fli has none (the word appears once, in a comment). Issue #50 carries a
  working `curl_cffi` monkey-patch; note `proxy=` takes a **string**, not `requests`' dict.

### Independent corroboration of the ~15% figure

Issue #200, `silvalucas9031` (2026-06-16) ran a controlled A/B through one proxy IP, same
minute, same `f.req`: raw fetch ≈1/6 data; curl_cffi Chrome TLS ≈1/6 (**TLS is not the gate**);
headless Chromium 0/3 (*worse* — BotGuard encodes the automation signal); **headful Chromium
6/6**; headful with the bgr header stripped → 1/4. Their no-bgr baseline of **1/6 = 16.7%**
matches our 6/40 = 15% almost exactly.

---

## 4. Current state (verified against the live DB, 2026-08-21)

| | |
|---|---|
| Migration head | `0008_route_expansion` applied to Neon **dev** — but 0008 lives only on unmerged PR #8, so dev is **ahead of `main`** |
| Routes | **14** (PR #8's 146-route seed has not been run) |
| `price_log` | 6,144 rows; history is June 3–13 plus today |
| Candidates | 9 new, 377 expired, 1 approved |
| Published deals | **1** live (VNO→LCA €140, travel 2026-09-30) — price unverified for 70 days |
| Subscribers | **16** (15 confirmed), signed up June 3–4, have received **nothing** |
| Email | **OFF** — no `RESEND_API_KEY`; site runs single opt-in |
| Digest sender | **does not exist** — nothing reads `subscribers.prefs` |

### Open branches

- **PR #8 `feat/route-expansion`** — open since 2026-06-12, awaiting founder review of the
  route list + 11 core picks. ⚠️ **Reconsider before merging**: at 15% throughput, scanning
  146 routes yields ~15% of expected data while multiplying request volume.
  Also note PR #8 re-adds `fli_timeout` (unused), which the audit deleted — it will
  re-break `test_fli_timeout_setting_removed` on merge.
- **`fix/audit-findings`** — 14 commits, still **no PR opened**.

---

## 5. Decisions and open questions

### Railway — recommend removing

`railway.toml` starts `fli-mcp-http`, which is an **AI-assistant tool** (Claude Desktop et
al). It has no end-user surface and nothing in Skrendam consumes it. Users get deals via the
site and email; they will never touch MCP.

Two further reasons to remove it: `run_http` defaults to **`host="0.0.0.0"`** (the README
claims `127.0.0.1` — the code disagrees), and there is **no authentication of any kind**;
the only PR proposing auth was closed unmerged.

**Hosting the scanner is a separate question** — and the BotGuard finding makes it much less
urgent, because the constraint is a signature we can't generate, not our IP.

### The real fork in the road

At ~15% supply, the pilot's deal-supply assumption no longer holds. Options, cheapest first:

1. **Monitor.** Let tomorrow's cold 06:00 scan run untouched and read `scan_runs.health`.
   Today's numbers are polluted — we hammered the endpoint with probes. **Do this first;
   it costs nothing and every other option depends on the answer.**
2. **Pace much slower.** Burstiness appears more punishing than daily volume.
3. **Headful browser path** (Playwright + real Chromium). The only approach with evidence of
   working *now*, because the page's own JS mints the `bgr` token. Big build. Notably it
   would also make cloud hosting viable again.
4. **Paid API** (SerpApi Google Flights or similar) for the core routes, keeping fli for
   breadth. Costs money; removes the BotGuard question entirely. This is also the long-flagged
   **R1** migration (an EU-legal, affiliate-enabled source) arriving earlier than planned.

### Unchanged blockers from previous handoffs

- **16 subscribers have received nothing for 79 days.** Independent of the gating — the June
  queue is stale but a hand-written email costs nothing and the runbook explicitly endorses it.
- **Pro tier would leak**: `publishDeal` hardcodes `tier:'free'` *and* `site/src/lib/queries.ts`
  has no tier filter. Both must change together, before any paid list exists.
- **Digest sender home** still undecided (Python job / Next cron / `scan_requests` kind).

---

## 6. Gotchas for the next session

- **The repo is at `/Users/superoptimised/Skrendam`.** Start Claude Code from there.
- **Never run tests while a scan is in flight** — concurrent `uv run` invocations mutate the
  shared `.venv` and can uninstall a package out from under the running scan.
- Test command that is actually green:
  `uv run pytest -q --ignore=tests/search -k "not test_search_dates_round_trip"`
  (both exclusions hit the live API and fail while gated — documented in `docs/PR-GATE.md`).
- **Never run `skrendam-scheduler`** — it would double-scan alongside launchd.
- `scan_runs` commits **once at the very end** of a run; an in-progress scan shows zero rows.
  That is not a failure.
- The `Unknown airport IATA code 'ZWS'/'AGY'` log spam is a known, harmless fli gap.
