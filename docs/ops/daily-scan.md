# Daily scan cadence (launchd, dev Mac)

The engine's designed heartbeat is one scan per day at 06:00 (Europe/Vilnius). Until there is a
hosted scheduler, it runs on the dev Mac via a launchd user agent.

## ⚠️ Keep the repo out of ~/Documents

macOS TCC denies launchd-spawned bash any access to `~/Documents`, `~/Desktop` and
`~/Downloads`, with **no prompt and no error you would ever see** — the job simply fails
every day. This cost 70 days of scans in 2026. The repo now lives at `~/Skrendam`, and
`install-daily-scan.sh` refuses to install if you move it back into a protected folder.

## Install (from the PRIMARY checkout, after merge)

    scripts/install-daily-scan.sh

This renders `scripts/launchd/com.skrendam.daily-scan.plist` with absolute paths into
`~/Library/LaunchAgents/` and loads it. Uninstall with `--uninstall`.

## What it runs

`scripts/daily-scan.sh` → `uv run skrendam run-scan` against the Neon dev-branch DB.
The connection string is read from `SKRENDAM_DATABASE_URL`, falling back to `DATABASE_URL` in
`web/.env.local` (gitignored). The secret never enters the repo or the plist.

## Two jobs get installed

| Job | When | What it does |
|---|---|---|
| `com.skrendam.daily-scan` | 06:00 | the scan; posts a notification with its outcome |
| `com.skrendam.watchdog` | 09:00 | dead-man's switch — silent unless the scan went missing, went degraded, or the job got unloaded |

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

- **Password with `$` in it:** the `.env` parser here does not unescape `\$` (the dotenv
  `$`-escape gotcha). If the Neon password ever rotates to one containing `$`, set
  `SKRENDAM_DATABASE_URL` directly in the plist environment instead of relying on the fallback.

## macOS privacy (TCC): "Operation not permitted"

If `launchd.err.log` shows `/bin/bash: …/scripts/daily-scan.sh: Operation not permitted`,
macOS is blocking launchd from reading the repo (anything under `~/Documents` is
TCC-protected; your terminal has access, launchd's bash does not). The schedule IS
firing — only the file read is denied. One-time fix, in order of preference:

1. System Settings → Privacy & Security → **Files and Folders** → `bash` →
   enable **Documents Folder** (bash appears in the list after the first denial).
2. If bash isn't listed: Privacy & Security → **Full Disk Access** → `+` → ⌘⇧G →
   `/bin/bash` → add and enable (broader grant).

Then `launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan` and check the log
ends `finished with exit 0` (or `2` = degraded — plumbing still fine).
