# Handoff — 2026-08-23 session close: full network live, Wave-1 scoring armed

_Continuation of a two-day sprint. Read `docs/handoffs/2026-08-22-redesign-wave1-phaseA.md`
for what shipped on day 1 (redesign, Wave-1 scoring, research cycle, traps); this doc is
the delta + what's next. Everything referenced is merged to `main` and CI-green._

## Where things stand (2026-08-23 ~afternoon)

- **Workstream A is COMPLETE.** PR #8 merged after 72 days (route network 14 → **159,
  29 core**), plus PR #13 (code-review fixes) and PR #14 (dark-wake scan retry).
  Dev Neon verified: 159 routes / 29 core / 10 templates / 10 moments / 6 audiences;
  alembic at merged head `0010`.
- **Supply question settled at n=2:** two consecutive cold 06:00-pace scans healthy
  (~4% gated, ~2,400 price rows each). BotGuard bites probing/burstiness, not the
  daily scan.
- **The machine is fully autonomous now:** founder ran
  `sudo pmset repeat wakeorpoweron MTWRFSU 05:58:00` (verified in `pmset -g sched`),
  so the Mac self-wakes; the wrapper (PR #14) waits for network and retries once after
  real wake. Primary checkout (`~/Skrendam`) pulled to `fae57ed`; launchd runs current
  code. Worker runs detached via nohup (log: `~/Library/Logs/skrendam/worker.log`) —
  it dies with reboots; restart with `SKRENDAM_DATABASE_URL=... uv run skrendam worker`
  from `~/Skrendam` (only needed for Deal Desk buttons).

## THE NEXT EVENT: 2026-08-24 ~06:00 scan

First **full-network** (~3× volume: 29 core + cohort slice) **Wave-1-scored** run.
Check `scripts/status.sh` / the notification:

- **Healthy** → the model holds at scale. Review the queue character: new groups
  (Visit-home fares, maybe Long-haul steal), first Dubai/Malta/Madeira candidates,
  month-local discounts, `outlier` reasons, possible "verify fast" flags.
- **Degraded** → burstiness is the suspect; the lever is cohort pacing
  (`tail_rotation_days`, worker/cli settings), NOT reverting routes. Compare
  `health.metrics` ratios with runs 11/13 before concluding anything.

## The founder's queued decision (asked & answered: "wait for Monday")

After seeing the first real full-network queue, pick the next build:

1. **Workstream B — digest email** (my standing recommendation; pilot centerpiece;
   zero subscribers exist, funnel untested = R0). Open design decision: sender's home
   (Python job vs Next cron vs `scan_requests` kind).
2. **Phase 3 desk polish** (deliberately deferred; see
   `docs/plans/2026-08-22-deal-desk-redesign.md` phases 3–4): Routes tab needs
   search/origin-grouping/history-depth meters at 159 rows; cohort-rotation
   visibility; template match-count feedback loops. Cosmetic, not blocking.

## Open threads & scheduled follow-ups

- **Code-review final consolidation never landed** (agent `code-review` in the
  2026-08-22 session): 7 confirmed findings FIXED (PR #13), 1 refuted, 2 minor
  verdicts still unresolved — "next scan 06:00" TZ label on PulseBar, cluster.ts
  €25-band edge. Re-run `/code-review` fresh rather than chasing the old agent.
- **~Dec 1:** flip `VNO-GVA` to core (ski season); revisit winter-sun template
  (split med/far price caps once real winter history exists); ski template live-check.
- **RIX routes scored with LT search volumes as proxy** — run a Latvian-volume pass
  before deepening RIX core picks (`docs/research/2026-08-22-route-scoring-phaseA.md`
  caveats).
- **Wave 2 product rules** (badge framing split, method-transparency line) and
  **Wave 3** (days-since-drop hazard — needs 14 consecutive scan days, counting from
  08-21; zone cold-start priors) per
  `docs/research/2026-08-22-deal-detection-synthesis.md`.
- **TLL as origin:** researched (route-refresh doc §6), seeding deliberately deferred.
- **Dev servers** (may be dead after reboot): Deal Desk `PORT=3002` from `~/Skrendam/web`
  (3000 is taken by another app; 3001 reserved for site); login `admin` /
  `E2E_ADMIN_PASSWORD` in `web/.env.local`.
- **Worktrees on disk:** `.claude/worktrees/deal-desk-redesign` (branch
  `fix/review-findings`, merged, keepable) and `.claude/worktrees/feat+route-expansion`
  (merged; candidate for cleanup via `git worktree remove` + branch delete).

## Traps for the next agent (beyond day-1's list)

- The worktree guard rejects compound/cd-crossing shell commands — write a script to
  the session scratchpad and `bash <path>` it instead.
- Regenerate `web/package-lock.json` with `npx npm@10` (CI is node 22/npm 10; local
  npm 11 lockfiles fail CI's `npm ci`).
- `ruff format` before EVERY Python commit (two red CI runs from skipping it).
- Long-lived processes started as session background tasks get reaped — use
  `nohup ... & disown`.
- Never probe Google Flights interactively; the daily scan is the only consumer.
- Offline test command: `uv run pytest -q --ignore=tests/search -k "not test_search_dates_round_trip"`.

## Suggested skills for the next session

- `yip-design-system` — MANDATORY before any UI/copy work (Deal Desk, site, email
  templates — especially Workstream B's digest template).
- `superpowers:using-git-worktrees` — feature work stays out of the primary checkout.
- `superpowers:brainstorming` — before starting Workstream B (sender-home decision
  and digest content model deserve exploration first).
- `code-review` — after any substantive diff; watch CI with
  `gh run watch <id> --exit-status`, verify via `gh run list`, never
  `gh pr checks --watch && gh pr merge`.
- `handoff` — at session close, keep this chain going.

## Key documents (do not re-derive; read these)

- `docs/handoffs/2026-08-22-redesign-wave1-phaseA.md` — day-1 summary + traps
- `docs/plans/2026-08-22-deal-desk-redesign.md` — desk IA, phases 3–4 backlog
- `docs/research/2026-08-22-deal-detection-synthesis.md` — scoring roadmap (Waves 2–3)
- `docs/research/2026-08-22-route-scoring-phaseA.md` — route evidence + caveats
- `docs/research/2026-08-21-vno-route-refresh-personas.md` — personas, TLL, decisions
- Memory: `skrendam-pilot-workstream-a`, `fli-google-rpc-gated-2026-06`,
  `skrendam-plan2-curator-admin` carry the durable state.
