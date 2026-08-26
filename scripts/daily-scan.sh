#!/usr/bin/env bash
# Daily Skrendam scan, designed to be launched by launchd (see install-daily-scan.sh).
# Logs to ~/Library/Logs/skrendam/daily-scan.log.
# Exit codes: 0 healthy, 2 degraded (propagated from `skrendam run-scan`), 1 setup failure.
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
LOG_DIR="$HOME/Library/Logs/skrendam"
LOG_FILE="$LOG_DIR/daily-scan.log"
mkdir -p "$LOG_DIR"

notify() { # title, message — best effort, never changes the job's exit code
  local m="${2//\"/}"; m="${m//\\/}"   # strip quotes AND backslashes: a trailing \ breaks the AppleScript literal
  osascript -e "display notification \"$m\" with title \"$1\"" >/dev/null 2>&1 || true
}

# The engine reads SKRENDAM_DATABASE_URL. If unset, reuse the Neon dev-branch URL
# the apps already use (web/.env.local, gitignored — the secret never enters the repo).
if [ -z "${SKRENDAM_DATABASE_URL:-}" ] && [ -f "$REPO_DIR/web/.env.local" ]; then
  url="$(grep -E '^DATABASE_URL=' "$REPO_DIR/web/.env.local" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$url" ] && export SKRENDAM_DATABASE_URL="$url"
fi
if [ -z "${SKRENDAM_DATABASE_URL:-}" ]; then
  # Notify too: this branch used to be silent in BOTH the scan and the watchdog,
  # so one deleted .env.local meant permanent silence — the 70-day-outage class.
  echo "$(date -Iseconds) ERROR: no SKRENDAM_DATABASE_URL and no web/.env.local DATABASE_URL" >> "$LOG_FILE"
  notify "Skrendam scan FAILED" "no database URL — web/.env.local missing?"
  exit 1
fi

# Power Nap dark wakes fire the missed 06:00 job with flaky networking; the DB
# connection then dies mid-run (2 crashes in 2 days: 2026-08-22/23). Wait for the
# network before scanning, and retry on connection-shaped failures — the
# sleeps survive re-sleep, so retries drift toward the REAL wake. caffeinate
# holds the machine awake for the attempt itself (best effort; absent on old
# macOS never blocks the scan).
wait_for_network() { # up to ~2h of 30s probes; returns 0 as soon as we're online
  for _ in $(seq 1 240); do
    curl -sf -m 5 -o /dev/null https://www.gstatic.com/generate_204 && return 0
    sleep 30
  done
  return 1
}

CAFF=""
command -v caffeinate >/dev/null 2>&1 && CAFF="caffeinate -im"

# Remember where the log ends now, so the notification below can quote THIS
# run's summary only — grepping the whole file showed yesterday's numbers
# whenever today's run crashed before printing one.
run_offset=$(( $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) ))

run_attempt() {
  echo "===== $(date -Iseconds) daily scan starting (repo: $REPO_DIR) ====="
  cd "$REPO_DIR" && $CAFF uv run skrendam run-scan
  code=$?
  echo "===== $(date -Iseconds) finished with exit $code ====="
}

{
  wait_for_network || echo "$(date -Iseconds) WARNING: network never came up; attempting anyway"
  attempt_offset=$(( $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) ))
  run_attempt
  # Retry up to 4 times on connection-shaped failures. One retry proved too few
  # (2026-08-26: attempt AND retry both landed inside clamshell-sleep windows,
  # then nothing was left to fire at the real wake). The 5-minute settle only
  # elapses while the machine is AWAKE — sleep pauses it — so successive
  # retries naturally drift toward a genuine wake, and the last one typically
  # runs after the lid opens.
  for retry in 1 2 3 4; do
    [ "$code" -eq 1 ] || break
    tail -n +$((attempt_offset + 1)) "$LOG_FILE" 2>/dev/null \
      | grep -aq 'OperationalError\|server closed the connection' || break
    echo "===== $(date -Iseconds) connection-shaped failure — retry $retry/4 after network + 5 min settle ====="
    wait_for_network
    sleep 300
    attempt_offset=$(( $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) ))
    run_attempt
  done
} >> "$LOG_FILE" 2>&1

summary="$(tail -n +$((run_offset + 1)) "$LOG_FILE" | grep -a '^scan complete:' | tail -1)"
case "$code" in
  0) title="Skrendam scan OK";       msg="${summary:-completed}" ;;
  2) title="Skrendam scan DEGRADED"
     # `uv` itself also exits 2 on its own config errors; only a run that
     # printed a summary is a genuine degraded scan.
     msg="${summary:+$summary — don't trust today's queue}"
     msg="${msg:-exited 2 before reporting — check daily-scan.log}" ;;
  1) title="Skrendam scan FAILED";   msg="crashed or setup problem — see daily-scan.log" ;;
  *) title="Skrendam scan exit $code"; msg="${summary:-see daily-scan.log}" ;;
esac
notify "$title" "$msg"

exit $code
