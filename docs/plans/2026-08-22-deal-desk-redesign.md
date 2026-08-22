# Deal Desk redesign — plan

_Date: 2026-08-22. Trigger: founder's first real triage session (227 candidates) exposed
broken numbers, navigation holes, and an IA that mirrors the database instead of the job.
Full screenshot walkthrough + code audit done same day. Execute in a worktree._

## The one-sentence diagnosis

The app shows **database contents** (9 tables → 9 nav items, match-rows counted as
"deals") when it should show **today's decisions** — the curator's morning loop is
buried under engine archaeology.

## The user and the job (design north star)

One user: the founder,每 morning, often with the window snapped to half-screen:

1. **Trust check** (10s): did the robot run, is the data trustworthy?
2. **Triage** (minutes): what did it find? publish / hold / dismiss.
3. **Maintenance** (occasional): is what's live still true?
4. **Tuning** (rare): thresholds, routes, templates.

IA weight must follow that order. Today it's inverted: tuning owns 5 of 9 nav slots.

## Hole inventory (verified against code/DB 2026-08-22)

### Bugs — numbers lie
- **B1. Match-rows counted as candidates.** Dashboard "1061 needs recheck" = all-history
  candidate×template rows (449 belong to current candidates; real current candidates:
  227). "329 high-score" same disease. `page.tsx` counts `views` (QueueRow[]) not
  distinct candidates.
- **B2. Timezone off by 3h.** Engine stores naive UTC; `mappers.ts:82` `timeAgo()` parses
  it as local. "5h ago" was 2h; Insights shows 05:42 for the 08:42 scan. One-place fix.
- **B3. June-expired leakage.** 377 expired June candidates appear in queue groups
  ("Christmas markets (20)" tops the queue in August) and in every count.
- **B4. "Needs recheck" is conceptually wrong.** Fresh-from-scan candidates are *supposed*
  to be unverified — scan IS verification. The only honest recheck population is live
  published deals gone stale. The real emergency (VNO→LCA live, price unverified 80
  days) renders as a healthy green "1".
- **B5. Scan run duration shows "0s"** on every run card (not recorded or not rendered).

### Navigation & wayfinding
- **N1. No way back to Today** — it's `/` but has no nav item and the logo doesn't link.
- **N2. 9 flat sidebar items;** daily loop (2) drowned by tuning (5) + meta (2). The
  `/config` hub page exists but the sidebar bypasses it (two paths, no hierarchy).
- **N3. Nav label ≠ page title** ("Insights" → page says "Scan health").
- **N4. Jargon labels** (Moments, Zones, Audiences) with no in-place explanation.

### Queue (the core surface)
- **Q1. Route/name truncated to "L. V…"** at half-screen — the primary datum invisible
  at the founder's actual window size. Responsive failure.
- **Q2. Default view mixes expired history with fresh candidates;** group order is
  driven by the mix (June ghosts first).
- **Q3. No bulk actions** (dismiss group / dismiss all expired) at 227-item scale.
- **Q4. Status chip occupies the scannable right column;** filters (All/Suggested/In
  review/Published/Rejected) exist but "In review" state has never been used — the
  hold/seen/maybe flow exists in code (`status.ts`) with no UI verb to enter it.
- **Q5. Gradient placeholder squares** carry zero information (destination image library
  will fill these later — decision §8 of 2026-08-21 research).
- **Q6. Row shows "why good" signals but never the catch** (thin baseline, overnight
  layover, basic economy) — the brand's own trust formula, unapplied where it matters
  most.
- **Q7. Score chip shows 100 on every visible row** — sorted-by-score view naturally
  tops out, so the number adds nothing where it's shown. (Distribution check during
  build; likely display-redundancy not scoring bug.)

### Published / Live
- **P1. No published_at, no price-verified-ago, no link to the public site page.**
- **P2. Only action is Expire** — no per-deal recheck or copy edit from this page.

### Scan health
- **S1. Numbers without judgment** — no "is this good?" verdict line, no delta vs
  previous run; degraded reasons (the useful part) under-surfaced. Plus B2/B5.

### Config/tuning pages
- **C1. Raw DB forms** — no "used by N templates", no downstream-effect line, Save gives
  no sense of consequence ("does this do anything?" — founder's literal question).
- **C2. Template cards truncate names**; thresholds (the tunable part) hidden.
- **C3. No mmdd validation** on season fields — the known 02-29 crash (deferred finding
  #3) is enterable from this UI today.
- **C4. Routes page won't survive PR #8** (146 routes): no origin grouping, no search,
  no per-route history-depth indicator (scorers silent under 8–10 points — invisible).
- **C5. No integrity surface** — winter-sun references MIDDLE_EAST zone that doesn't
  exist yet (fine! rides with PR #8) but nothing explains that anywhere.

### Cross-cutting
- **X1. No system pulse** — worker up? scan in flight? next scan when? A scan mid-flight
  silently shifts queue numbers during review.
- **X2. No "as of HH:MM"** on any number.
- **X3. Half-screen is the real viewport** — design target, not an afterthought.
- **X4. Empty states undesigned** (post-triage queue, Draft(0), Expired(0)).

## The redesign

### Shell
- **Topbar** (component exists): wordmark → links to `/` (fixes N1) · right side system
  pulse: "Scan 08:42 ✓ · next 06:00 · worker idle" (X1).
- **Sidebar: 4 items** (fixes N2):
  1. **Today** (`/`)
  2. **Review** (`/queue`) — badge: fresh count
  3. **Live** (`/published`) — badge only when attention needed (stale price)
  4. **Machine** (`/machine`) — tabs: Scan health · Templates · Routes · Zones ·
     Audiences · Moments (absorbs `/scans` + `/config/*`; old URLs redirect)

### Today — three zones, no stat grid
1. **Verdict headline** (true, timestamped): "Scan ran 08:42 ✓ healthy — Google answered
   96%. **227 fresh deals** to review." One primary CTA: "Start reviewing →".
2. **Live status with real emergencies surfaced** (fixes B4): "1 live · VNO→LCA price
   unverified 80 days → Recheck".
3. **Next scan countdown** + last-7-runs mini-trend (defer trend if it drags).

### Review
- **Default scope: fresh (latest scan) only.** Chips: Fresh / On hold / Everything
  (expired only under Everything). Fixes B3/Q2.
- Groups ordered by fresh great-tier count; rows by score, then discount.
- **Row = mini boarding pass** (curator ui_kit): mono route "VNO → BER" never truncated
  (Q1/X3), price hero + was + drop%, airline/stops, tier chip, one why-good line **and
  one catch line** (Q6). Whole row → Composer (which already exists and works).
- **Hold verb** in row + Composer — wires the existing seen/maybe state to UI (Q4).
- **Bulk: dismiss group / dismiss all expired** (Q3).
- Composer additions: price-history sparkline vs baseline, the catch list, template
  context. (Composer bones stay.)

### Live
- Card: published X days ago · price verified Y ago (amber >7d, coral >30d) · travel
  window · link to site page · actions Recheck / Edit copy / Expire (P1/P2).

### Machine
- **Scan health:** verdict line per run ("✓ 96% answered · 2,410 prices · 22 min"),
  delta vs previous, degraded reasons first-class, durations fixed (S1/B5).
- **Templates:** thresholds visible on card, **"matched N in last scan"** (the tuning
  feedback loop), enable/disable, links to its audience/moment (C1/C2).
- **Routes:** grouped by origin, search, per-route history-depth meter
  ("12/10 pts — all scorers active"), ready for 146 (C4).
- **Zones/Audiences/Moments:** each entity gets "used by N templates" + one-line
  downstream effect + integrity notes (C1/C5). Season mmdd validation (C3).

### Copy & brand
- Sentence case, plain language ("To review today", not "NEEDS RECHECK"), numbers
  always with "as of". Tokens from `colors_and_type.css`; boarding-pass rows and
  Lucide icons per the design system. English UI (internal tool). Every count =
  distinct current candidates (B1).

## Phases (each shippable, each tested)

- **Phase 1 — make the numbers true** (no layout change): fix `timeAgo` UTC parsing
  (B2); dashboard counts → distinct current candidates (B1); queue default excludes
  expired (B3); "needs recheck" → stale-live-deals metric (B4); published_at +
  verified-ago chips on Live (P1). _Small diff, immediately trustworthy._
- **Phase 2 — the shell**: Topbar home-link + pulse, 4-item sidebar, `/machine` tabs
  with redirects, Today rebuilt (3 zones), Review scope chips + ordering + bulk
  dismiss + row redesign, Live actions. _The visible redesign._
- **Phase 3 — feedback loops**: template match-counts, route history meters, scan
  verdict lines + deltas, config used-by chips + mmdd validation.
- **Phase 4 — later**: destination images in rows (needs image library), keyboard
  triage, digest-composition surface (arrives with Workstream B — leave the seam:
  approved deals list is its input).

Mock-first option for Phase 2: one static HTML (Today + Review, real data snapshot,
design-system tokens) for founder reaction before touching the app.

## Explicitly not doing
- No rewrite — Next.js app, queries, Composer, auth all stay.
- No new backend features (digest, tiers, analytics) — seams only.
- No Lithuanian localization of the internal tool.
- Keyboard triage deferred (Phase 4) — bulk actions cover the 227-scale pain first.

## Decisions (founder, 2026-08-22)
1. Sidebar naming: **Today / Review / Live / Machine**.
2. **Mock-first** for Phase 2: static HTML of Today + Review (real data snapshot,
   design-system tokens) for reaction before app code.
