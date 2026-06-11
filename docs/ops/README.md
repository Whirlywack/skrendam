# Skrendam — owner's guide

> The plain-language manual for running this product day to day. No code knowledge assumed.
> Deeper docs: [daily-scan.md](daily-scan.md) (the scheduled scan), [upstream-watch.md](upstream-watch.md)
> (watching the fli fork), `CONTEXT.md` at the repo root (domain vocabulary),
> `docs/PR-GATE.md` (how code ships).

---

## 1. What this system is, in one paragraph

Skrendam finds cheap flights from the Baltics, you pick the good ones, and a public site
shows them. A robot does the finding and scoring; **you are the only human step** — nothing
reaches the public site until you click Publish in the Deal Desk. The robot's data comes from
one source: the `fli` library, which talks to Google Flights' private API. That source
sometimes gets blocked by Google **silently** — which is why the system now watches its own
health (section 4).

## 2. How a deal travels (the pipeline)

```
1. SCAN (robot, daily 06:00)   asks Google "what does every day cost?" on your routes,
                               spots unusually cheap days, pulls the real bookable fare
2. SCORE (robot, instant)      four scoring strategies judge each fare → queue, best first
3. CURATE (YOU, Deal Desk)     review the queue at localhost:3000, edit the copy, click Publish
4. SHOW (site, automatic)      yip site (localhost:3001 / prod) renders it within ~5 minutes
5. AGE OUT (robot, automatic)  deals expire when their valid-until or travel date passes;
                               unreviewed queue items expire 14 days after discovery
```

Two facts worth remembering:

- **Publishing IS the insert** — clicking Publish writes one row to `published_deals`; the
  site reads that table. There's no deploy, no sync, nothing else.
- **Rechecks can never remove a deal.** If a recheck can't find the fare, the deal stays
  live and gets an "unverified since …" chip in the admin. Only dates or you expire deals.
  (This protects you from Google outages masquerading as "deal gone".)

## 3. The four scoring strategies — and why some are quiet

| Strategy | Question it asks | Needs |
|---|---|---|
| `weighted` | "Cheap vs the surrounding weeks?" | nothing — works from day one |
| `drop` | "Did the price crash since the **last scan**?" | a previous scan day |
| `error_fare` | "Suspiciously below the **cheapest ever seen**?" | ≥ 8 recorded prices |
| `rarity` | "In the **cheapest 10% ever** for this route?" | ≥ 10 recorded prices |

Three of the four feed on **price history**, which only accumulates when scans run daily.
With the daily scan installed, `drop` switches on from day two; the other two get meaningful
after a week or two. Until then, `weighted` carries the queue — that's expected, not broken.

## 4. Scan health — the thing this initiative added

Google sometimes blocks the robot's requests **without an error** (it returns "no results"
instead). The engine now tells the difference between "quiet market" and "broken pipe":

| Status | Meaning | What you do |
|---|---|---|
| `completed` | Healthy scan, trust the results | Nothing — curate the queue |
| `degraded` | Scan finished but most searches came back empty — **Google is gating** | Don't trust "no deals today"; **don't run bulk "recheck live"**; wait for the next scan |
| `failed` | Circuit breaker aborted mid-run (loud errors like timeouts) | Check the log; usually transient — next scan recovers |

Where the signal shows up (all three say the same thing):

- **Deal Desk dashboard** — a red banner when the latest run is degraded/failed, with the
  reasons (e.g. "33/40 calendar searches returned no data").
- **The log** — `~/Library/Logs/skrendam/daily-scan.log`, one block per run, ends with
  `finished with exit 0` (healthy) or `exit 2` (degraded/failed, reasons above it).
- **The database** — `scan_runs.status` + a `health` column with reasons and error details.

A degraded scan **keeps whatever data it did get** — the status means "don't treat this as a
full picture of the market", not "thrown away".

Real example: the very first scheduled-style run (June 11) caught Google gating 33 of 40
searches and flagged itself degraded — 90 minutes after an identical scan ran clean. The
blocking is intermittent. That's normal now; the system sees it so you don't have to guess.

## 5. Your daily rhythm (once the launchd job is installed)

1. Scan runs by itself at 06:00 (Mac asleep? it runs once on wake).
2. Open the Deal Desk. **No red banner?** Trust the queue; curate; publish the winners.
3. **Red banner?** Skip judgement on "no new deals", avoid bulk rechecks, carry on — the
   next morning's scan usually comes back clean.
4. Deals you published age out by themselves when their dates pass.

What's automatic: finding, scoring, health-checking, date-expiry. What's manual: publishing
(by design), the `skrendam worker` (only needed for the admin's enqueue/recheck buttons),
and reacting to a banner.

## 6. When something looks wrong — triage

| Symptom | Most likely cause | Check / fix |
|---|---|---|
| Queue is empty | Scans aren't running, or candidates hit the 14-day TTL | `tail ~/Library/Logs/skrendam/daily-scan.log` — is anything running? Reinstall: `scripts/install-daily-scan.sh` |
| Banner says degraded for days | Google gating persistently | Wait it out (data already shows it heals) or revisit the HTML-fallback idea (section 8); check `docs/ops/upstream-watch.md` reports for an upstream fix |
| "unverified since" chips piling up | Rechecks failing during gating | Harmless; chips clear on the next successful recheck. Republish also clears them |
| A live deal is obviously dead | Sold out for real (rechecks can't prove it anymore) | Expire it manually in the admin — you're the override |
| Scan log ends `exit 1` | Setup problem (no DB URL found) | Is `web/.env.local` present in the checkout the job points at? See [daily-scan.md](daily-scan.md) |
| Site shows nothing | There are simply no live published deals | Publish something — the site only renders `published_deals` |

## 7. Command cheat-sheet

Run from the repository root (`uv` handles the Python environment):

```bash
uv run skrendam run-scan        # one scan now (exit 0 healthy / 2 degraded-or-failed)
uv run skrendam worker          # start the queue poller (admin buttons need this running)
uv run skrendam analyze         # tuning stats over collected data
scripts/install-daily-scan.sh   # install the 06:00 daily scan (run from PRIMARY checkout)
scripts/install-daily-scan.sh --uninstall
tail -40 ~/Library/Logs/skrendam/daily-scan.log

cd web  && npm run dev          # Deal Desk on localhost:3000
cd site && npm run dev          # public site on localhost:3001

uv run pytest -q --ignore=tests/search   # offline test suite (the green-or-not check)
scripts/pr-gate.sh --base=origin/main    # the pre-PR verification gate
```

Never run `skrendam-scheduler` — it's a legacy in-process timer that would double-scan
alongside the launchd job.

## 8. Decisions already made (so you don't re-litigate them)

- **Empty results never expire deals** — a missing fare can't be distinguished from a
  blocked request, so absence of evidence is not evidence of absence. Trade-off: a genuinely
  sold-out deal lingers until its date passes or you expire it.
- **No HTML fallback yet** — when Google blocks the API, a slower page-scrape path exists
  and was verified working. It's deliberately a *future* initiative; the API still works at
  our gentle pace most of the time.
- **fli stays vendored** — we keep our own copy of the Google Flights library so we can
  patch it; a weekly scheduled agent watches the upstream project for fixes
  ([upstream-watch.md](upstream-watch.md)).
- **Detection thresholds are starting values** — "degraded = half the searches empty" etc.
  live as constants in `skrendam/fli_adapter/health.py`, to be tuned once there's a few
  weeks of real scan history.

## 9. Where the deeper docs live

| Doc | What it covers |
|---|---|
| `CONTEXT.md` (repo root) | Domain vocabulary — what "degraded", "unverified_since", "Scorer" etc. mean precisely |
| `docs/superpowers/specs/2026-06-11-fli-resilience-design.md` | The full design of the health/resilience system |
| `docs/superpowers/plans/2026-06-11-fli-resilience.md` | The task-by-task build record |
| [daily-scan.md](daily-scan.md) | The scheduled scan: install, logs, edge cases |
| [upstream-watch.md](upstream-watch.md) | The weekly fli-fork watch agent |
| `docs/PR-GATE.md` | The verification ritual every code change passes before a PR |
| `docs/codebase-research.md` (primary checkout, untracked) | Architecture map of the whole monorepo |
