#!/usr/bin/env bash
# Render the launchd templates with absolute paths and load them for this user.
# Usage: scripts/install-daily-scan.sh [--uninstall]
# Run this from the PRIMARY checkout (not a worktree) — the plists hardcode the repo path.
#
# Installs two jobs:
#   com.skrendam.daily-scan  06:00  the scan itself
#   com.skrendam.watchdog    09:00  dead-man's switch — notifies only if the scan
#                                   did NOT run, or ran badly. A job that never
#                                   starts reports nothing, which is how the
#                                   2026-06/08 outage stayed invisible for 70 days.
#                                   (Also RunAtLoad: closes the powered-off-overnight
#                                   gap at next login, and proves notifications work.)
#
# NOTE: keep this repo OUT of ~/Documents, ~/Desktop and ~/Downloads. macOS TCC
# denies launchd-spawned bash any access to those three folders, with no prompt.
set -uo pipefail

# pwd -P: resolve symlinks. A symlinked path (~/Skrendam -> ~/Documents/Skrendam)
# would pass a logical-path check while launchd still gets TCC-denied on the
# real files — the guard below must see the physical location.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
JOBS=(daily-scan watchdog)

if [ "${1:-}" = "--uninstall" ]; then
  for job in "${JOBS[@]}"; do
    # Bootout by LABEL, not plist path — works even when the plist file was
    # deleted while the job is still loaded.
    launchctl bootout "gui/$(id -u)/com.skrendam.$job" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/com.skrendam.$job.plist"
    echo "uninstalled com.skrendam.$job"
  done
  exit 0
fi

case "$REPO_DIR" in
  "$HOME"/Documents/*|"$HOME"/Desktop/*|"$HOME"/Downloads/*)
    echo "REFUSING: $REPO_DIR is inside a macOS TCC-protected folder." >&2
    echo "launchd cannot read it and the scan will fail silently every day." >&2
    echo "Move the repo (e.g. to ~/Skrendam) and re-run this script." >&2
    exit 1 ;;
esac

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/skrendam"
failed=0
for job in "${JOBS[@]}"; do
  src="$REPO_DIR/scripts/launchd/com.skrendam.$job.plist"
  dst="$HOME/Library/LaunchAgents/com.skrendam.$job.plist"
  sed -e "s|__REPO_DIR__|$REPO_DIR|g" -e "s|__HOME__|$HOME|g" "$src" > "$dst"
  launchctl bootout "gui/$(id -u)/com.skrendam.$job" 2>/dev/null || true
  if ! launchctl bootstrap "gui/$(id -u)" "$dst"; then
    echo "FAILED to load com.skrendam.$job — fix and re-run; do not leave a half-installed pair" >&2
    failed=1
  fi
done
[ "$failed" -eq 0 ] || exit 1

echo "installed:"
echo "  com.skrendam.daily-scan  06:00  the scan (notifies you when it finishes)"
echo "  com.skrendam.watchdog    09:00  alerts only if the scan went missing or bad"
echo "logs in ~/Library/Logs/skrendam/"
echo
echo "check status any time:  scripts/status.sh"
echo "trigger a scan now:     launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan"
