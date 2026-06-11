# PR Gate

The ritual every branch passes **before** a PR is opened. It exists to catch
regressions and keep the repo's bookkeeping honest — across all four toolchains
in this monorepo (Python `fli`+`skrendam`, `fli-js` on Bun, the `web` and `site`
Next.js apps on Neon/Drizzle).

**Principle: lane-aware.** You only run the verification lanes your diff
touches. A skrendam-only change does not rebuild the Next.js apps; a CSS tweak
in `site` does not run pytest. The runner figures out which lanes apply from the
changed files.

**Order matters:** `A` verify → `B` review → re-run touched lanes → `C`
housekeeping → `D` open the PR. Reviews come *after* the code is green and
*before* the PR, because a review of broken code is wasted, and findings often
change the code again.

---

## How to run it

```bash
# Mechanical lanes (tests, typecheck, lint, migration no-diff, enum drift):
scripts/pr-gate.sh

# Add the slow checks (cold Next builds + Playwright e2e):
scripts/pr-gate.sh --full

# Stacked branch? point the diff at the real base (default: main):
scripts/pr-gate.sh --base=feat/site-cro-redesign
```

The script runs everything it safely can and prints a summary. It **cannot** run
the two code-review passes for you — those are mandatory human/agent steps it
reminds you about at the end. The script's green is necessary, not sufficient.

---

## A · Code verification (lanes)

| Lane | Triggers when the diff touches… | What runs |
|------|----------------------------------|-----------|
| **P · Python** | `fli/` `skrendam/` `tests/` `alembic/` `pyproject.toml` | pytest (offline), `ruff format --check`, `ruff check` |
| **M · Migration** | `alembic/versions/` | model⇄migration no-diff, + live-apply / Drizzle-repull checklist |
| **MCP** | `fli/mcp/` | param-naming + error-envelope + doc reminder |
| **J · fli-js** | `fli-js/` `data/` | `bun run ci`, enum-codegen drift |
| **W · web** | `web/` | vitest, `tsc --noEmit`, eslint, cold build, `'use server'`/auth reminder |
| **S · site** | `site/` | vitest, `tsc --noEmit`, eslint, cold build, Playwright, signup/SEO reminder |

### Lane P — Python (`fli` + `skrendam`)

1. **Tests** — `uv run pytest <targets> --ignore=tests/search/ -k "not test_search_dates_round_trip"`.
   The runner scopes `<targets>` to the changed area (`tests/skrendam` for engine
   changes, the `fli` test dirs for library changes). `tests/search/` and
   `test_search_dates_round_trip` hit the live Google Flights API and are
   excluded on purpose (see AGENTS.md); skrendam's live tests skip themselves.
2. **Lint + format (ratchet)** — only the `.py` files *this branch changes*, within
   the project's enforced scope (`make lint` targets `fli/ scripts/ tests/`):
   `uv run --extra dev ruff check <changed>` + `ruff format --check <changed>`.
   `skrendam/` and `alembic/` sit **outside** `make lint` today, and CI's full
   `ruff check .` carries known pre-existing debt — so the gate diff-scopes to keep
   the bar on *your* change, not the backlog. (Cleaning up the engine's lint debt
   and widening the target is a worthwhile follow-up, tracked separately.)

### Lane M — Migrations (the riskiest lane; read this twice)

A migration is not "done" until the schema, both Drizzle copies, and the deploy
record all agree.

1. **Model ⇄ migration no-diff** — `uv run pytest tests/skrendam/test_migration.py`.
   This applies the head and runs `alembic check`; it fails if `models.py` and the
   migration disagree (nullability, indexes, defaults). It catches the classic
   "I added the column to the model but the migration left it nullable" bug.
2. **Additive-only on a live DB.** The Neon database holds real published deals
   and subscribers. New tables, new **nullable** columns, new indexes, and
   `server_default`-backed NOT NULL columns are safe. Dropping/retyping a column,
   or a NOT NULL with no default, is **not** — those need an explicit decision and
   a backfill plan.
3. **Apply, then re-pull Drizzle in BOTH apps.** After `alembic upgrade head`
   against Neon, run `drizzle-kit pull` (with `DATABASE_URL_UNPOOLED` from the
   app's `.env.local`) in **`web/` and `site/`** and **commit** the regenerated
   `src/db/generated/`. The apps read introspected snapshots — skip this and they
   silently reference a stale schema.
4. **Record it.** Note the new revision in the PR body (applied to live? backfill
   run?), so the deploy is reproducible.

### Lane MCP — `fli/mcp/`

- New tool keeps the house naming: `origin`/`destination`, `cabin_class`,
  `max_stops`, locale `currency`/`language`/`country`.
- Errors return `{"success": false, "error": …}`; success payloads carry a
  deterministic `booking_url`.
- Update the **MCP Tool Reference** in `CLAUDE.md`.

### Lane J — `fli-js` / `data/`

- `cd fli-js && bun run ci` (Biome format-check + oxlint + `tsc` + `bun test`).
- If `data/*.csv` changed: `bun run generate:enums` must leave **no diff** in
  `fli-js/src/models/` — the generated airport/airline enums track the CSVs, and
  CI fails on drift.
- Wire parity: if you changed encoding/tokens on either side, the snapshot tests
  (`tests/integration/filter_format_snapshots`, `tests/search/proto`) must keep
  Python and JS byte-identical.

### Lane W — `web` (curator admin)

- `npm run test` (vitest) · `npx tsc --noEmit` (exit 0) · **eslint on changed
  files** (ratchet — like the Python lane, so a PR isn't blocked by pre-existing
  app-wide lint debt; CI runs the full `npm run lint`).
- **Cold build** (`--full`): `rm -rf .next && npm run build`. A stale `.next` has
  produced false "build clean" results — delete it.
- New **server action**: the `'use server'` module must export *only* async
  actions; re-exporting a pure helper corrupts the server-reference manifest and
  404s the form post. Put helpers in `lib/`.
- Auth: every new action/route guards with `requireAdmin()`.

### Lane S — `site` (public)

- `npm run test` · `npx tsc --noEmit` · **eslint on changed files** (ratchet, as
  in Lane W).
- **Cold build** (`--full`): `rm -rf .next && npm run build`.
- **Playwright** (`--full`): kill any stale dev server on `:3001`, then
  `npx playwright test`.
- New public surface: signup tokens stay httpOnly + single-use; JSON-LD carries
  **no** Offer/price; `robots`/`sitemap` stay live-only; `'use server'` purity as
  in Lane W.

---

## B · Review ritual (ALWAYS — every PR, no exceptions)

This is the part the script cannot do and the part that catches what tests miss.

1. **`/code-review high`** — fix the findings.
2. **`superpowers:requesting-code-review`** — fix the **union** of both reviews.
3. **Re-run the touched A-lanes** after the fixes (`scripts/pr-gate.sh` again).

Both passes are required even when the diff "looks trivial." If a review changes
the code, you re-verify; green-before-review is stale by the time review lands.

---

## C · Housekeeping (committed, not just done)

Bookkeeping only counts if it's in tracked files — not in the chat.

- **Spec + plan committed** under `docs/superpowers/specs/` and
  `docs/superpowers/plans/` (this repo's convention).
- **`CONTEXT.md` updated** if the change introduced domain vocabulary (a new
  Scorer, a new lifecycle state, …).
- **No secrets.** `.env.local` files stay gitignored. Never commit a connection
  string or token. (`web/.env.local` holds the Neon URL — read it in a subprocess,
  print only the host, never paste it.)
- **Only intended files staged.** This monorepo accumulates stray working-tree
  noise (`site/next-env.d.ts`, `*.tsbuildinfo`, other branches' e2e artifacts).
  `git add` explicit paths; don't `git add -A`.
- **Stacked-branch targeting.** If you branched off an open PR branch, target that
  branch in the PR and retarget to `main` after it merges.

---

## D · PR description must contain

- **Links** to the spec and plan.
- **Per-lane evidence**, with caveats **verbatim**: test counts (e.g. "skrendam
  75 passed, 2 skipped — live tests"), `tsc` exit 0, build result, and what was
  *measured* (e.g. "backfilled 246 matches; 90 great+rare").
- **Migrations added** — revision id, applied-to-live? Drizzle re-pulled in both
  apps?
- **Security** of each new surface (new RPC/action/route/MCP tool/public page).
- **Both code-review passes done.**

Then open the PR via **`superpowers:finishing-a-development-branch`**.

---

## Repo gotchas this gate guards against

- Live-API Python tests (`tests/search/`, `test_search_dates_round_trip`) fail
  without network — always excluded.
- `models.py` ↔ Alembic drift — caught by `test_migration.py` (`alembic check`).
- Drizzle schema staleness after a migration — re-pull in **both** apps.
- `'use server'` non-async re-export → form-action 404.
- `.env` bcrypt hashes need `$` escaped as `\$` (dotenv-expand); skrendam's
  pydantic-settings is unaffected.
- Stale `.next` → false "build clean" → always cold-build before trusting it.
- Score meaning lives in one place (`skrendam/scanning/scoring/tiering.py`); web
  `tiers.ts` / site `quality.ts` read it — don't re-encode thresholds.
