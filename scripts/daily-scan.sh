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

# Remember where the log ends now, so the notification below can quote THIS
# run's summary only — grepping the whole file showed yesterday's numbers
# whenever today's run crashed before printing one.
run_offset=$(( $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) ))

{
  echo "===== $(date -Iseconds) daily scan starting (repo: $REPO_DIR) ====="
  cd "$REPO_DIR" && uv run skrendam run-scan
  code=$?
  echo "===== $(date -Iseconds) finished with exit $code ====="
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
