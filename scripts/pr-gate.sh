#!/usr/bin/env bash
#
# Pre-PR gate for the Skrendam / Fli monorepo. Lane-aware: runs only the
# verification lanes your diff touches. See docs/PR-GATE.md for the full ritual,
# including the two mandatory code-review passes this script cannot run for you.
#
#   scripts/pr-gate.sh                 # mechanical lanes only
#   scripts/pr-gate.sh --full          # also cold Next builds + Playwright
#   scripts/pr-gate.sh --base=<ref>    # diff against <ref> (default: main)
#
set -uo pipefail

BASE_REF="${PR_GATE_BASE:-main}"
FULL=0
for a in "$@"; do
  case "$a" in
    --full) FULL=1 ;;
    --base=*) BASE_REF="${a#--base=}" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT"

MB="$(git merge-base HEAD "$BASE_REF" 2>/dev/null || true)"
if [ -z "$MB" ]; then
  echo "✗ cannot find a merge-base with '$BASE_REF'. Pass --base=<ref>." >&2
  exit 2
fi

# Changed paths = committed since branch point ∪ uncommitted tracked ∪ untracked.
# --diff-filter=ACMR drops DELETED files (feeding a deleted path to ruff/eslint is a
# spurious FAIL). Using `git diff` (not `git status | awk`) keeps space-containing
# paths intact; core.quotePath=false avoids octal-escaping non-ASCII names.
CHANGED="$( {
  git -c core.quotePath=false diff --name-only --diff-filter=ACMR "$MB" HEAD
  git -c core.quotePath=false diff --name-only --diff-filter=ACMR HEAD
  git -c core.quotePath=false ls-files --others --exclude-standard
} | sort -u )"
N_CHANGED="$(printf '%s\n' "$CHANGED" | grep -c . || true)"
echo "pr-gate · base=$BASE_REF (merge-base ${MB:0:9}) · $N_CHANGED changed paths · full=$FULL"

has() { printf '%s\n' "$CHANGED" | grep -qE "$1"; }

PASS=0; FAIL=0; SKIP=0
FAILED_STEPS=""
SKIPPED_LANES=""

step() { # step "name" cmd...
  local name="$1"; shift
  echo; echo "▶ $name"; echo "  \$ $*"
  if "$@"; then
    echo "  ✓ $name"; PASS=$((PASS+1))
  else
    echo "  ✗ $name (exit $?)"; FAIL=$((FAIL+1)); FAILED_STEPS="$FAILED_STEPS\n  ✗ $name"
  fi
}
note() { echo "  • $*"; }

# ───────────────────────── Lane P · Python ─────────────────────────
if has '^(fli/|skrendam/|tests/|alembic/|pyproject\.toml|alembic\.ini)'; then
  echo; echo "═══ Lane P · Python (fli + skrendam) ═══"
  PYT=""
  has '^(skrendam/|alembic/|tests/skrendam/)' && PYT="$PYT tests/skrendam"
  has '^fli/'                                  && PYT="$PYT tests/cli tests/models tests/core tests/mcp"
  has '^(scripts/|tests/scripts/)'             && PYT="$PYT tests/scripts"
  [ -z "$PYT" ] && PYT="tests"
  step "pytest [$PYT]" uv run pytest $PYT --ignore=tests/search/ -k "not test_search_dates_round_trip" -q

  # Ratchet: lint only the .py files THIS branch changes, within the project's
  # enforced scope (`make lint` targets fli/ scripts/ tests/; skrendam/ + alembic/
  # are intentionally outside it). CI runs the full `ruff check .`, which carries
  # known pre-existing debt — diff-scoping keeps the gate about YOUR change.
  CHG_PY="$(printf '%s\n' "$CHANGED" | grep -E '^(fli|scripts|tests)/.*\.py$' || true)"
  if [ -n "$CHG_PY" ]; then
    step "ruff check (changed, lint scope)" uv run --extra dev ruff check $CHG_PY
    step "ruff format --check (changed, lint scope)" uv run --extra dev ruff format --check $CHG_PY
  else
    note "no changed .py files in the lint scope (fli/ scripts/ tests/)"
  fi

  # ─── Lane M · Migration ───
  if has '^alembic/versions/'; then
    echo; echo "═══ Lane M · Migration ═══"
    step "alembic model⇄migration no-diff" uv run pytest tests/skrendam/test_migration.py -q
    note "additive/nullable only on the live DB."
    note "after 'alembic upgrade head' on Neon: run drizzle-kit pull in web AND site, commit the regen."
    note "record the revision (applied to live? backfill run?) in the PR body."
  fi

  # ─── Lane MCP ───
  if has '^fli/mcp/'; then
    echo; echo "═══ Lane MCP ═══"
    note "keep origin/destination/cabin_class/max_stops naming + {success:false} envelope."
    note "update the MCP Tool Reference in CLAUDE.md."
  fi
fi

# ───────────────────────── Lane W · web ─────────────────────────
if has '^web/'; then
  echo; echo "═══ Lane W · web (curator admin) ═══"
  step "web vitest"       bash -c 'cd web && npm run test'
  step "web tsc --noEmit" bash -c 'cd web && npx tsc --noEmit'
  # Ratchet: eslint only the changed .ts/.tsx (excluding generated Drizzle schema).
  CHG_WEB_TS="$(printf '%s\n' "$CHANGED" | grep -E '^web/.*\.(ts|tsx)$' | grep -vE '/generated/' | sed 's#^web/##' || true)"
  if [ -n "$CHG_WEB_TS" ]; then
    step "web eslint (changed)" bash -c 'cd web && npx eslint "$@"' _ $CHG_WEB_TS
  else
    note "no changed web .ts/.tsx to lint"
  fi
  if [ "$FULL" = 1 ]; then
    step "web cold build" bash -c 'cd web && rm -rf .next && npm run build'
  else
    note "skipped cold build — re-run with --full before opening the PR"
  fi
  note "new server action ⇒ 'use server' exports only async actions; requireAdmin() on new actions/routes."
fi

# ───────────────────────── Lane S · site ─────────────────────────
if has '^site/'; then
  echo; echo "═══ Lane S · site (public) ═══"
  step "site vitest"       bash -c 'cd site && npm run test'
  step "site tsc --noEmit" bash -c 'cd site && npx tsc --noEmit'
  # Ratchet: eslint only the changed .ts/.tsx (excluding generated Drizzle schema).
  CHG_SITE_TS="$(printf '%s\n' "$CHANGED" | grep -E '^site/.*\.(ts|tsx)$' | grep -vE '/generated/' | sed 's#^site/##' || true)"
  if [ -n "$CHG_SITE_TS" ]; then
    step "site eslint (changed)" bash -c 'cd site && npx eslint "$@"' _ $CHG_SITE_TS
  else
    note "no changed site .ts/.tsx to lint"
  fi
  if [ "$FULL" = 1 ]; then
    step "site cold build" bash -c 'cd site && rm -rf .next && npm run build'
    lsof -ti tcp:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
    step "site playwright" bash -c 'cd site && npx playwright test'
  else
    note "skipped cold build + Playwright — re-run with --full before opening the PR"
  fi
  note "new public surface ⇒ httpOnly/single-use signup token; JSON-LD has NO Offer/price; sitemap/robots live-only."
fi

# ───────────────────────── coverage catch-all ─────────────────────────
# Surface changed paths that matched NO lane, so a new top-level package can't
# pass the gate untested just because no lane regex covers it yet.
LANE_RE='^(fli/|skrendam/|tests/|alembic/|alembic\.ini|pyproject\.toml|uv\.lock|web/|site/|data/|examples/|scripts/|docs/|mkdocs\.yml|\.github/|\.claude/|\.devcontainer/|\.gitignore|\.dockerignore|Dockerfile|docker-compose\.yml|railway\.toml|nixpacks\.toml|pytest\.ini|Makefile|LICENSE\.txt|CONTEXT\.md|AGENTS\.md|CLAUDE\.md|.*\.md|.*\.png|.*\.lock|Yip Design System/)'
UNMATCHED="$(printf '%s\n' "$CHANGED" | grep -vE "$LANE_RE" || true)"
if [ -n "$UNMATCHED" ]; then
  echo; echo "⚠ changed paths matched NO lane (NOT verified) — add a lane if these need checks:"
  printf '%s\n' "$UNMATCHED" | sed 's/^/    /'
fi

# ───────────────────────── summary ─────────────────────────
echo; echo "──────── pr-gate summary ────────"
echo "passed: $PASS · failed: $FAIL · lanes skipped: $SKIP"
[ -n "$SKIPPED_LANES" ] && printf '%b\n' "$SKIPPED_LANES"
[ -n "$FAILED_STEPS" ]  && printf '%b\n' "$FAILED_STEPS"
echo
echo "MANDATORY human/agent steps this script cannot run (see docs/PR-GATE.md §B–D):"
echo "  1. /code-review high                       → fix findings"
echo "  2. superpowers:requesting-code-review      → fix the union, then re-run touched lanes"
echo "  3. Housekeeping (C): spec+plan committed · CONTEXT.md updated · no secrets · only intended files staged"
echo "  4. PR body (D): spec/plan links · per-lane evidence + caveats · migrations (applied? drizzle re-pulled?) · security of new surfaces"

if [ "$FAIL" -gt 0 ]; then
  echo; echo "GATE: FAIL — fix the ✗ steps above, then re-run."
  exit 1
fi
echo; echo "GATE: mechanical checks PASS — now complete the human steps above before opening the PR."
