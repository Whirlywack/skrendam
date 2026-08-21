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

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALERT_MODE=false
[ "${1:-}" = "--alert" ] && ALERT_MODE=true

if ! command -v psql >/dev/null 2>&1; then
  # Never silently degrade into a false alarm — say what is actually wrong.
  msg="psql not found on PATH; cannot read scan status"
  $ALERT_MODE && osascript -e "display notification \"$msg\" with title \"Skrendam watchdog broken\"" \
    >/dev/null 2>&1
  echo "$(date -Iseconds) ERROR: $msg" >&2
  exit 1
fi

# Same secret-resolution rule as daily-scan.sh: env first, then web/.env.local.
if [ -z "${SKRENDAM_DATABASE_URL:-}" ] && [ -f "$REPO_DIR/web/.env.local" ]; then
  url="$(grep -E '^DATABASE_URL=' "$REPO_DIR/web/.env.local" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$url" ] && export SKRENDAM_DATABASE_URL="$url"
fi
if [ -z "${SKRENDAM_DATABASE_URL:-}" ]; then
  echo "ERROR: no database URL (set SKRENDAM_DATABASE_URL or provide web/.env.local)" >&2
  exit 1
fi

# STALE_HOURS: how long without a finished scan before we call it broken.
# 26 gives the 06:00 job a 2h grace window for a sleeping Mac.
STALE_HOURS=${STALE_HOURS:-26}

db_err=$(mktemp)
read -r age_hours status candidates matches reasons queue live unverified subs < <(
  psql "$SKRENDAM_DATABASE_URL" -X -t -A -F ' ' -v ON_ERROR_STOP=1 <<SQL 2>"$db_err"
SELECT
  COALESCE(round(EXTRACT(EPOCH FROM (now() - max(r.started_at)))/3600)::text, '9999'),
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
)
# A failed query must NOT masquerade as "no scans ever" — that is a false alarm,
# and a watchdog that lies gets ignored, which defeats the whole point.
if [ -z "${age_hours:-}" ]; then
  msg="cannot reach the database: $(tr '\n' ' ' < "$db_err" | cut -c1-120)"
  rm -f "$db_err"
  $ALERT_MODE && osascript -e "display notification \"${msg//\"/}\" with title \"Skrendam watchdog broken\"" \
    >/dev/null 2>&1
  echo "$(date -Iseconds) ERROR: $msg" >&2
  exit 1
fi
rm -f "$db_err"

job_loaded=$(launchctl list 2>/dev/null | grep -c com.skrendam.daily-scan || true)
worker_up=$(pgrep -f "skrendam worker" >/dev/null 2>&1 && echo yes || echo no)

problems=()
[ "$age_hours" -ge "$STALE_HOURS" ] && problems+=("no scan finished in ${age_hours}h")
[ "$job_loaded" -eq 0 ] && problems+=("daily-scan job is NOT loaded in launchd")
[ "$status" = "degraded" ] && problems+=("last scan degraded")
[ "$status" = "failed" ] && problems+=("last scan failed")

if $ALERT_MODE; then
  # Silent when healthy. Only speak up when something needs a human.
  if [ ${#problems[@]} -gt 0 ]; then
    msg="$(IFS='; '; echo "${problems[*]}")"
    osascript -e "display notification \"${msg//\"/}\" with title \"Skrendam needs attention\"" \
      >/dev/null 2>&1 || true
    echo "$(date -Iseconds) ALERT: $msg"
    exit 2
  fi
  exit 0
fi

g=$'\033[32m'; y=$'\033[33m'; r=$'\033[31m'; d=$'\033[2m'; n=$'\033[0m'
case "$status" in
  completed) sc="${g}healthy${n}" ;;
  degraded)  sc="${y}DEGRADED${n}" ;;
  failed)    sc="${r}FAILED${n}" ;;
  *)         sc="${r}no scans ever${n}" ;;
esac
if   [ "$age_hours" -ge "$STALE_HOURS" ]; then ac="${r}${age_hours}h ago — STALE${n}"
elif [ "$age_hours" -ge 12 ];             then ac="${y}${age_hours}h ago${n}"
else                                           ac="${g}${age_hours}h ago${n}"; fi

printf '\n  %sSKRENDAM%s  %s\n\n' "$d" "$n" "$(date '+%a %d %b %H:%M')"
printf '  last scan     %s   %s\n' "$sc" "$ac"
printf '  found         %s candidates, %s matches\n' "$candidates" "$matches"
[ "$reasons" != "[]" ] && printf '  %swhy%s           %s\n' "$y" "$n" "${reasons//\~/ }"
printf '  daily job     %s\n' "$([ "$job_loaded" -gt 0 ] && echo "${g}armed for 06:00${n}" || echo "${r}NOT INSTALLED${n}")"
printf '  worker        %s %s\n' \
  "$([ "$worker_up" = yes ] && echo "${g}running${n}" || echo "${d}not running${n}")" \
  "$([ "$worker_up" = yes ] || echo "${d}(only needed for admin buttons)${n}")"
printf '\n  to review     %s candidates in the queue\n' "$queue"
printf '  published     %s live%s\n' "$live" \
  "$([ "$unverified" -gt 0 ] && echo " (${y}${unverified} unverified${n})" || echo "")"
printf '  subscribers   %s\n\n' "$subs"
if [ ${#problems[@]} -gt 0 ]; then
  printf '  %s!%s %s\n\n' "$r" "$n" "$(IFS='; '; echo "${problems[*]}")"
fi
