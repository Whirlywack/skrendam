# Handoff — 2026-08-28 session close: V2 Lithuanian site SHIPPED to yip.lt

**Next session's mission: wire the live site to live deals** (desk publishing → site
content). Everything else here is state + guardrails.

## ⚠️ THE RULE (read first, binding, in auto-memory as `skrendam-mockup-signoff-rule`)

**No design/visual change ships without a founder-approved mockup or screenshot
FIRST.** Mockups must show the REAL data state (e.g. 1 live deal), not idealized
content. Copy approval ≠ design approval. This session earned a 3/10 by violating it;
the repair worked only because three audit agents + screenshot sign-off came first.

## What is LIVE right now

- **https://yip.lt** (and www) serves the **V2 "Poster & Bead" Lithuanian site** —
  PRs #23–#26 all merged 08-28. DNSSEC saga RESOLVED (iv.lt ticket removed the DS;
  TLS force-issued via `npx vercel certs issue`). GitHub→Vercel pipeline works:
  PR previews + prod-on-merge (root dir fix + preview DATABASE_URL).
- Spec (approved, §8 decisions resolved): `docs/plans/2026-08-28-v2-lt-site-spec.md`.
- Key code: `site/src/lib/lt.ts` (string catalog + configurable `curator()`),
  `format.ts` (LT dates/plurals/eur/freshInfo), `cities-lt.*` (106 exonyms, 3 cases),
  `components/v2/*` (Masthead/Poster/CaptureRow/Rows/InkBand/V2Footer),
  `styles/poster-bead.css` (design-system foundations, verbatim) + `styles/v2.css`
  (composition only). Fonts load via `<link>` in `app/layout.tsx` — **never** a nested
  CSS `@import` (bundler strips it silently; production ran system fonts for weeks).
- Scan self-healing chain PASSED its first full trial (4 attempts, 3 Neon connection
  drops, checkpoint/resume): **187 candidates / 317 matches landed this morning.**
  Watch the recurring Neon drops — new failure pattern, not BotGuard.
- Deal Desk (`web/`): top-20 shortlist on "New today" (PR #23).

## NEXT: wire the site to live deals

The site is code-complete but content-starved (1 stale live deal). The pipeline:

1. **Desk ops (founder or with founder):** publish a handful of today's 187
   candidates from the Deal Desk; **expire/recheck the dead VNO→LCA €140** (published
   Jun 3, last seen 86 d ago — it is the current featured poster!).
2. **What fills automatically:** „Dar spėji" index (2nd+ live deal), „Buvo. Nebėra."
   trophy case (first expired PUBLISHED deals), poster rotation (featured = newest
   live). Verify the page with 3–5 real deals at desktop+mobile — the multi-deal
   state has NEVER been rendered with real data.
3. **The LT content gap (likely the real work):** curator-entered DB copy
   (`pd.headline`, `pd.body`, `pd.publicLabel`) is written in the desk's Composer in
   ENGLISH. The site displays it verbatim (only fallbacks are LT). Either the desk
   composer (`web/src/components/Composer.tsx` / CopyDrafter) needs an LT pass, or
   deal copy is entered manually in LT. English `publicLabel` is deliberately NOT
   shown on the V2 poster kicker anymore — LT labels would restore that slot.
4. **First e2e signup test (never done):** founder clicks **Verify** on yip.lt in
   Resend, then submits a real email on yip.lt → confirm email → click → subscribers
   row → (optionally) early-alerts upgrade email flow (`/confirm?early=1`).

## Pending, explicitly NOT done (founder-visible list)

1. **Two conversion patches awaiting mockup sign-off:** hero email row; masthead nav
   links („Radiniai · Kryptys"). Mock as screenshot → approve → build.
2. **PR C scope:** inner pages (/subscribe, /early-alerts, deal page, collections)
   still wear V1 dress; privacy page (GDPR gap — no privacy link anywhere); sample
   „Skaityk Nr. 1 laišką" page (from the real first email only); curator name/photo/
   quote (set `CURATOR_NAME` env; component slots exist); FAQ returns as a proper V2
   page (content deleted from repo — recover from git history, `Faq.tsx` pre-#26).
3. **Cleanup debt (cosmetic):** subscribe-form state machine copy-pasted in 4
   components; some v2.css literals vs tokens; redirect slugs hardcoded in
   next.config.ts.
4. **Ops:** rotate the dev Neon DB password (it appeared in chat 08-28; Neon project
   `still-mode-83548775`, branch `dev`); prod site + previews + scan all share the
   dev-branch compute — revisit before real traffic.

## References (don't re-derive)

- Journey audit (3 agents, founder-approved): artifact `18ceaad6-763b-44a1-9aa8-a6972a363cad`
- V2 spec page: artifact `8314e167-afe4-43ce-8ec4-466581df3b4e`; canvas mockups:
  artifact `6cc22be5-aba0-4f1c-8255-a029f7fa9af5`
- Code-review findings fixed in PR #26 (see its description for the list)
- Previous handoff: `docs/handoffs/2026-08-27-funnel-redesign-session-close.md`
- Design system: `.claude/skills/yip-design-system` (V2 = default direction)

## Suggested skills for the next session

- `yip-design-system` — before ANY Yip UI/brand/copy work (mandatory per memory)
- `superpowers:using-git-worktrees` — all feature work in worktrees off main
- `code-review` — after each PR's implementation
- `impeccable` or `design` — for the mockup-first sign-off loop on visual changes
- `handoff` — at session close

## Gotchas that bit this session

- Worktree guard rejects compound/heredoc Bash — write scripts to the scratchpad and
  run them by path.
- `gh pr checks --watch` doesn't stop merges on failure — use `gh run watch
  --exit-status` or the check-loop script pattern.
- Vercel CLI `env add` loops on a git-branch prompt non-interactively — use the REST
  API (`/v10/projects/{id}/env`) or the dashboard.
- Playwright MCP is available for screenshots (screenshot → founder sign-off loop);
  Chrome extension was not connected this session.
- The site's `.yip-site` wrapper still applies V1 classes globally — check for
  collisions when adding V2 class names (`.early` burned us once).
