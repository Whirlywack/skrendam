#!/usr/bin/env bash
# Render the launchd template with absolute paths and load it for this user.
# Usage: scripts/install-daily-scan.sh [--uninstall]
# Run this from the PRIMARY checkout (not a worktree) — the plist hardcodes the repo path.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SRC="$REPO_DIR/scripts/launchd/com.skrendam.daily-scan.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.skrendam.daily-scan.plist"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "uninstalled com.skrendam.daily-scan"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/skrendam"
sed -e "s|__REPO_DIR__|$REPO_DIR|g" -e "s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"
launchctl bootout "gui/$(id -u)" "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
echo "installed: daily scan at 06:00 local time; logs in ~/Library/Logs/skrendam/"
echo "trigger a run now:  launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan"
