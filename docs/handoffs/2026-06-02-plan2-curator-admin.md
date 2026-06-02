# Handoff — Skrendam **Plan 2: Internal Curator Admin** (Next.js, wired to real data)

_Date: 2026-06-02. Audience: a fresh agent picking up Plan 2._

## TL;DR
Plan 1 — the headless **Python deal engine** — is built, QA'd, and **merged to `main`** (PR #1). Your job is **Plan 2: the internal curator "Deal Desk"** — a **Next.js** app, auth-gated (single user), reading the engine's **Postgres schema via Drizzle introspection**, with the Spec §10 page map **wired to REAL data** (candidate queue → review → approve / recheck → `published_deals`), built from the existing **`yip-design-system` curator UI kit**. Recommended path (user already agreed): **short Plan 2 spec → `writing-plans` → `subagent-driven-development` (TDD) → QA gate → PR → merge.** Skip a long brainstorm — the design is already specified.

## Repo & branch state
- Repo: `/Users/superoptimised/Documents/Skrendam` (a fork of `punitarani/fli`; origin = https://github.com/Whirlywack/skrendam).
- `main` = the merged engine, **green** (`34 passed, 2 skipped`).
- You are already on **`feat/curator-admin`** (branched off the updated `main`).
- **Workflow loop:** branch off `main` → spec → `writing-plans` → `subagent-driven-development` → push → PR → merge → delete branch. `main` always stays green.

## Strategic context — keep this in the back of your mind
Plan 2 is one step in a bigger arc; don't build it in a vacuum.
- **The product** is a curated **Baltic flight-deal club** (brand: *Yip*). Build order: internal curator tool (this, Plan 2) → minimal public site + email capture (Spec 2) → monetization (Spec 3). The **near-term business goal is growing an owned email audience, not revenue yet.**
- **Funnel / R0 (a top risk):** organic **TikTok → owned audience (email/Telegram) → paid membership.** Audience conversion is *unproven*. It should be validated **in parallel and cheaply** (a hand-run Telegram channel + no-code email capture, posting a few real curated deals) — don't assume demand just because the tooling is good. The admin's real purpose is to make the founder **fast at producing genuinely good deals** to fuel that test.
- **R1 (data source / affiliate):** `fli` (reverse-engineered Google Flights) is acceptable for this **private/internal phase only.** Before going public/paid, the production data source likely must move to an **EU-legal, affiliate-enabled API** (e.g. Travelpayouts). Affects Spec 2/3, not the Plan 2 build — but keep the data layer swappable.
- **R2 (supply):** deal *supply* from VNO/KUN/RIX (PLQ = bonus) is the #1 viability gate. The engine's thresholds are **seeded estimates** that need a **live-network tuning dry-run** before anyone relies on queue volume.
- **Design for the next surface:** the admin writes `published_deals` (with `public_label`/`newsletter_tag`) precisely so **Spec 2's public site + segmented newsletter** can be a thin reader. Keep that output clean.
- Full risk analysis: `docs/research/2026-06-01-deal-engine-v1-review-brief.md`; deferred items: `docs/superpowers/out-of-scope.md`.

## Read these first (source of truth — do NOT duplicate)
- **Curator design (your primary spec input):** `docs/superpowers/specs/2026-06-01-deal-engine-curator-design.md` — especially **§10** (curator page map, statuses, AI-agent-friendly object boundaries), **§6** (data model / 12 tables), **§11** (Spec 2 public-funnel handoff), **§12** (stack).
- **Engine schema you read:** `skrendam/db/models.py` (12 tables). Schema is **Alembic-owned**: `alembic/versions/0001_initial.py`.
- **Design system skill — build the UI from this:** `.claude/skills/yip-design-system/` → `SKILL.md`, `README.md`, `colors_and_type.css` (all tokens), and **`ui_kits/curator/`** (Sidebar/Queue/Composer/App — currently a React-UMD + Babel demo on mock `data.js`; port to real Next.js). Public kit `ui_kits/website/` is for Spec 2.
- **Out-of-scope register (deferred work + Plan 2/Spec 2/Spec 3):** `docs/superpowers/out-of-scope.md`.
- **Risk brief:** `docs/research/2026-06-01-deal-engine-v1-review-brief.md` (R0 audience conversion, R1 data source/affiliate).
- Engine plan (patterns/context): `docs/superpowers/plans/2026-06-02-deal-engine-scanner.md`.

## Plan 2 scope (internal-only, per Spec §10)
Today dashboard · **deal queue grouped by template** (join `candidates`↔`candidate_template_matches`↔`deal_templates`; filter status/origin/trip_type/min-score; sort by `match_score`) · **candidate review room** (price vs baseline, per-template `reason_text`, itinerary warnings, full `itinerary_snapshot`, `verified_at`/recheck, editable headline/tiktok/newsletter from `content_drafts`) · **publish panel** → write `published_deals` + set `candidate.status` · **published-deals management** · **config CRUD** (deal_templates, audience_segments, travel_moments, routes, zones) · **scan health** (from `scan_runs`).

## Firm decisions (keep these — from Spec §6/§10/§12)
- Stack: **Next.js App Router + TypeScript on Vercel**, **Drizzle**, **Auth.js Credentials** (single admin from env), **Neon Postgres** (Vercel Marketplace).
- **Alembic (Python) is the ONLY thing that migrates the schema. The Next.js app never runs migrations — generate types with `drizzle-kit pull` (introspect the live DB).**
- Internal-only / auth-gated. Public site is Spec 2 (separate, later).
- Data-model nuances: **one `candidate` per real fare**; many `candidate_template_matches` (queue is grouped by template); status lifecycle `new→seen→maybe→approved→edited→rejected→expired`; **curator decisions are never resurrected** by a re-scan; `content_drafts` seed editorial copy (`created_by` = system|curator|ai_future).

## Resolve these EARLY in the Plan 2 spec
1. **Cross-process recheck / "run scan now".** The scanner is a separate **Python** worker; the admin is **Next.js** — it can't call Python directly. Pick: (a) admin writes a request row the worker polls; (b) a tiny Python HTTP endpoint (e.g. FastAPI) the admin calls; (c) admin is curate-only and the worker rechecks on schedule. (Engine already has `recheck_candidate()` and `run_scan` in Python.)
2. **Local dev data.** "Wired to real data" needs a populated shared DB. Either run a local Postgres + `uv run skrendam run-scan --seed` against it (engine needs **Python ≤3.13** via `uv`; set `SKRENDAM_DATABASE_URL`), or provision Neon and run the engine against it. Then `drizzle-kit pull` from that DB.
3. **DB provisioning:** Neon via Vercel Marketplace; one shared `DATABASE_URL` / `SKRENDAM_DATABASE_URL`.
4. **Approach:** user chose **straight to a short Plan 2 spec** (no long brainstorm).

## QA gate before merging Plan 2 (the user expects the full gauntlet)
Run in this order, fix between: `/code-review high` → re-run; **`security-review`**; **type checks** (`tsc` / Next lint for the app; existing `mypy` clean for any Python); **E2E tests**; and now that a real UI exists, the **Playwright connected end-to-end journey** (login → real candidate → approve → `published_deals`). Use **`superpowers:receiving-code-review`** when processing review feedback (verify before implementing — invoke it *before* fixing, not after). Anything cut → append to `docs/superpowers/out-of-scope.md`.

## Suggested skills
- **yip-design-system** — REQUIRED for all UI/brand/copy (a project memory enforces this). Build from `ui_kits/curator`.
- **superpowers:writing-plans** → **superpowers:subagent-driven-development** — same loop as Plan 1.
- **vercel:nextjs**, **vercel:shadcn** (if using shadcn/ui), **vercel:auth** (Auth.js), **vercel:marketplace** / **vercel:vercel-storage** (Neon Postgres), **vercel:env-vars**, **vercel:deployments-cicd**.
- **context7** for current Drizzle (`drizzle-kit pull`) + Next.js docs.
- QA: **code-review** (`/code-review high`), **security-review**, **superpowers:receiving-code-review**, **superpowers:verification-before-completion**, **playwright** (MCP) for the connected journey.
- **superpowers:finishing-a-development-branch** to land the PR.

## Gotchas / housekeeping
- Engine requires **Python ≤3.13** via `uv` (3.14 breaks `pydantic-core`) — only when running the engine to populate dev data.
- A throwaway gallery server may still be running on **http://127.0.0.1:8765** (serving `.claude/skills/yip-design-system/_gallery.html`). Kill `python -m http.server 8765` and delete the untracked `_gallery.html` when done.
- The untracked `Yip Design System/` folder at repo root is the original source; the canonical copy is the installed skill at `.claude/skills/yip-design-system/`.
- No secrets here — all config is env-based (`DATABASE_URL` / `SKRENDAM_*`).
