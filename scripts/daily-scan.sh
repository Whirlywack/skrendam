#!/usr/bin/env bash
# Daily Skrendam scan, designed to be launched by launchd (see install-daily-scan.sh).
# Logs to ~/Library/Logs/skrendam/daily-scan.log.
# Exit codes: 0 healthy, 2 degraded (propagated from `skrendam run-scan`), 1 setup failure.
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/skrendam"
LOG_FILE="$LOG_DIR/daily-scan.log"
mkdir -p "$LOG_DIR"

# The engine reads SKRENDAM_DATABASE_URL. If unset, reuse the Neon dev-branch URL
# the apps already use (web/.env.local, gitignored — the secret never enters the repo).
if [ -z "${SKRENDAM_DATABASE_URL:-}" ] && [ -f "$REPO_DIR/web/.env.local" ]; then
  url="$(grep -E '^DATABASE_URL=' "$REPO_DIR/web/.env.local" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$url" ] && export SKRENDAM_DATABASE_URL="$url"
fi
if [ -z "${SKRENDAM_DATABASE_URL:-}" ]; then
  echo "$(date -Iseconds) ERROR: no SKRENDAM_DATABASE_URL and no web/.env.local DATABASE_URL" >> "$LOG_FILE"
  exit 1
fi

{
  echo "===== $(date -Iseconds) daily scan starting (repo: $REPO_DIR) ====="
  cd "$REPO_DIR" && uv run skrendam run-scan
  code=$?
  echo "===== $(date -Iseconds) finished with exit $code ====="
} >> "$LOG_FILE" 2>&1

# Tell the founder the outcome instead of making them go read a log.
# ponytail: osascript notification, no daemon, no menu-bar app. Best effort —
# never let notification trouble change the job's exit code.
summary="$(grep -a '^scan complete:' "$LOG_FILE" | tail -1)"
case "$code" in
  0) title="Skrendam scan OK";       msg="${summary:-completed}" ;;
  2) title="Skrendam scan DEGRADED"; msg="${summary:-no data} — don't trust today's queue" ;;
  1) title="Skrendam scan FAILED";   msg="setup problem — scan never started" ;;
  *) title="Skrendam scan exit $code"; msg="${summary:-see daily-scan.log}" ;;
esac
osascript -e "display notification \"${msg//\"/}\" with title \"$title\"" >/dev/null 2>&1 || true

exit $code
