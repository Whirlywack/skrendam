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
  exit $code
} >> "$LOG_FILE" 2>&1
