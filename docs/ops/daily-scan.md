# Daily scan cadence (launchd, dev Mac)

The engine's designed heartbeat is one scan per day at 06:00 (Europe/Vilnius). Until there is a
hosted scheduler, it runs on the dev Mac via a launchd user agent.

## Install (from the PRIMARY checkout, after merge)

    scripts/install-daily-scan.sh

This renders `scripts/launchd/com.skrendam.daily-scan.plist` with absolute paths into
`~/Library/LaunchAgents/` and loads it. Uninstall with `--uninstall`.

## What it runs

`scripts/daily-scan.sh` → `uv run skrendam run-scan` against the Neon dev-branch DB.
The connection string is read from `SKRENDAM_DATABASE_URL`, falling back to `DATABASE_URL` in
`web/.env.local` (gitignored). The secret never enters the repo or the plist.

## Where to look

- Log: `~/Library/Logs/skrendam/daily-scan.log` — one block per run, ending in
  `finished with exit 0` (healthy) or `exit 2` (DEGRADED or FAILED — the reasons are printed
  above it).
- Deal Desk dashboard — shows a warning banner whenever the latest run is degraded/failed.

## Behavior notes

- **Mac asleep at 06:00:** launchd runs a missed `StartCalendarInterval` job once on next wake —
  late, never twice.
- **Degraded ≠ discarded:** a degraded run's data is committed; the status means "don't trust this
  as a picture of the market" (see `CONTEXT.md` → Scan health).
- **Exit-code caveat:** argparse usage errors also exit 2; for this job's fixed arguments that
  can't happen, but don't treat "exit 2" as exclusively meaning degraded in other contexts.
- The `skrendam worker` queue-poller (admin enqueue buttons) is NOT covered by this job — start it
  manually when needed: `uv run skrendam worker`.

- **Do not also run `skrendam-scheduler`** (the legacy in-process APScheduler entry point): it
  schedules the same 06:00 scan and, alongside this launchd job, would double-scan and
  double-write. launchd is the only sanctioned cadence on this machine.
