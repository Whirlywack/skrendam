#!/usr/bin/env bash
# Skrendam at-a-glance status. Two modes:
#   scripts/status.sh           print the dashboard
#   scripts/status.sh --alert   say nothing unless something is wrong, then notify
#                               (this is the dead-man's switch — a scan that never
#                                runs produces no error, which is exactly how the
#                                June-August 2026 outage stayed invisible for 70 days)
set -uo pipefail

# launchd hands jobs a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin), so psql is
# not on it. Without this the query fails, the result falls through to the
# "no scans ever" sentinel, and the watchdog cries wolf every single morning.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ALERT_MODE=false
[ "${1:-}" = "--alert" ] && ALERT_MODE=true

notify() { # title, message — best effort, never changes our exit code
  local m="${2//\"/}"; m="${m//\\/}"   # strip quotes AND backslashes: a trailing \ breaks the AppleScript literal
  osascript -e "display notification \"$m\" with title \"$1\"" >/dev/null 2>&1 || true
}

fail_loud() { # message — an unhealthy watchdog must never die silently
  $ALERT_MODE && notify "Skrendam watchdog broken" "$1"
  echo "$(date -Iseconds) ERROR: $1" >&2
  exit 1
}

command -v psql >/dev/null 2>&1 || fail_loud "psql not found on PATH; cannot read scan status"

# Same secret-resolution rule as daily-scan.sh: env first, then web/.env.local.
if [ -z "${SKRENDAM_DATABASE_URL:-}" ] && [ -f "$REPO_DIR/web/.env.local" ]; then
  url="$(grep -E '^DATABASE_URL=' "$REPO_DIR/web/.env.local" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$url" ] && export SKRENDAM_DATABASE_URL="$url"
fi
[ -n "${SKRENDAM_DATABASE_URL:-}" ] || fail_loud "no database URL (web/.env.local missing or has no DATABASE_URL)"

# STALE_HOURS: how long without a FINISHED scan before we call it broken.
# 26 gives the 06:00 job a 2h grace window for a sleeping Mac.
STALE_HOURS=${STALE_HOURS:-26}
case "$STALE_HOURS" in
  ''|*[!0-9]*) fail_loud "STALE_HOURS='$STALE_HOURS' is not an integer — staleness alarm would be disarmed" ;;
esac

query_status() {
  psql "$SKRENDAM_DATABASE_URL" -X -t -A -F ' ' -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  COALESCE(round(EXTRACT(EPOCH FROM (now() - max(r.finished_at)))/3600)::text, '9999'),
  COALESCE((SELECT status FROM scan_runs ORDER BY id DESC LIMIT 1), 'none'),
  COALESCE((SELECT candidates_found FROM scan_runs ORDER BY id DESC LIMIT 1)::text, '0'),
  COALESCE((SELECT matches_created FROM scan_runs ORDER BY id DESC LIMIT 1)::text, '0'),
  COALESCE((SELECT replace(replace((health::jsonb->'reasons')::text,' ','~'),'"','')
            FROM scan_runs ORDER BY id DESC LIMIT 1), '[]'),
  (SELECT count(*) FROM candidates WHERE status IN ('new','seen','maybe'))::text,
  (SELECT count(*) FROM published_deals WHERE status='live')::text,
  (SELECT count(*) FROM published_deals WHERE status='live' AND unverified_since IS NOT NULL)::text,
  (SELECT count(*) FROM subscribers)::text
FROM scan_runs r;
SQL
}

db_err=$(mktemp)
line="$(query_status 2>"$db_err")"
if [ -z "$line" ] && $ALERT_MODE; then
  # RunAtLoad / wake can fire us before Wi-Fi associates — one patient retry
  # before declaring the database unreachable.
  sleep 45
  line="$(query_status 2>"$db_err")"
fi
if [ -z "$line" ]; then
  err="$(tr '\n' ' ' < "$db_err" | cut -c1-120)"; rm -f "$db_err"
  # A failed query must NOT masquerade as "no scans ever" — a watchdog that
  # cries wolf gets ignored, which defeats the whole point.
  fail_loud "cannot reach the database: $err"
fi
rm -f "$db_err"
read -r age_hours status candidates matches reasons queue live unverified subs <<<"$line"

scan_job=$(launchctl list 2>/dev/null | grep -c com.skrendam.daily-scan || true)
wd_job=$(launchctl list 2>/dev/null | grep -c com.skrendam.watchdog || true)
worker_up=$(pgrep -f "skrendam worker" >/dev/null 2>&1 && echo yes || echo no)
# The engine commits in ONE transaction at run end, so an in-flight scan is
# invisible in the DB — check the process table before calling it missing.
scan_inflight=$(pgrep -f "skrendam run-scan" >/dev/null 2>&1 && echo yes || echo no)

problems=()
if [ "$age_hours" -ge "$STALE_HOURS" ]; then
  if [ "$scan_inflight" = yes ]; then
    : # late but running right now (e.g. Mac just woke) — not a problem yet
  else
    problems+=("no scan finished in ${age_hours}h")
  fi
fi
[ "$scan_job" -eq 0 ] && problems+=("daily-scan job is NOT loaded in launchd")
[ "$wd_job" -eq 0 ] && problems+=("watchdog job is NOT loaded in launchd")
[ "$status" = "degraded" ] && problems+=("last scan degraded")
[ "$status" = "failed" ] && problems+=("last scan failed")

if $ALERT_MODE; then
  if [ ${#problems[@]} -gt 0 ]; then
    msg="$(IFS=';'; echo "${problems[*]}")"
    notify "Skrendam needs attention" "$msg"
    echo "$(date -Iseconds) ALERT: $msg"
    exit 2
  fi
  # Heartbeat: one line per healthy run, so an empty watchdog.log can be told
  # apart from a watchdog that has been dead for months.
  echo "$(date -Iseconds) OK"
  exit 0
fi

g=$'\033[32m'; y=$'\033[33m'; r=$'\033[31m'; d=$'\033[2m'; n=$'\033[0m'
case "$status" in
  completed) sc="${g}healthy${n}" ;;
  degraded)  sc="${y}DEGRADED${n}" ;;
  failed)    sc="${r}FAILED${n}" ;;
  *)         sc="${r}no scans ever${n}" ;;
esac
if   [ "$scan_inflight" = yes ];          then ac="${y}running now${n}"
elif [ "$age_hours" -ge "$STALE_HOURS" ]; then ac="${r}${age_hours}h ago — STALE${n}"
elif [ "$age_hours" -ge 12 ];             then ac="${y}${age_hours}h ago${n}"
else                                           ac="${g}${age_hours}h ago${n}"; fi

printf '\n  %sSKRENDAM%s  %s\n\n' "$d" "$n" "$(date '+%a %d %b %H:%M')"
printf '  last scan     %s   %s\n' "$sc" "$ac"
printf '  found         %s candidates, %s matches\n' "$candidates" "$matches"
[ "$reasons" != "[]" ] && printf '  %swhy%s           %s\n' "$y" "$n" "${reasons//\~/ }"
printf '  daily job     %s\n' "$([ "$scan_job" -gt 0 ] && echo "${g}armed for 06:00${n}" || echo "${r}NOT INSTALLED${n}")"
printf '  watchdog      %s\n' "$([ "$wd_job" -gt 0 ] && echo "${g}armed for 09:00${n}" || echo "${r}NOT INSTALLED${n}")"
printf '  worker        %s %s\n' \
  "$([ "$worker_up" = yes ] && echo "${g}running${n}" || echo "${d}not running${n}")" \
  "$([ "$worker_up" = yes ] || echo "${d}(only needed for admin buttons)${n}")"
printf '\n  to review     %s candidates in the queue\n' "$queue"
printf '  published     %s live%s\n' "$live" \
  "$([ "$unverified" -gt 0 ] && echo " (${y}${unverified} unverified${n})" || echo "")"
printf '  subscribers   %s\n\n' "$subs"
if [ ${#problems[@]} -gt 0 ]; then
  printf '  %s!%s %s\n\n' "$r" "$n" "$(IFS=';'; echo "${problems[*]}")"
fi
