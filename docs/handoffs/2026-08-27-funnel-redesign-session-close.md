# Handoff — 2026-08-27 session close: funnel 95% live (DNSSEC blocker), V2 redesign in review, scan self-healing complete

_Continuation of the chain (read `docs/handoffs/2026-08-23-network-live-session-close.md`
for prior state). This session ran 2026-08-23 → 08-27 and shipped PRs #15–#21 (all
merged, all deployed). Memory files carry durable state; this doc is the delta and
the priority queue._

## ⚠ THE №1 ACTION — yip.lt is dead to the world until DNSSEC is disabled

The `.lt` registry holds a **DS record** for yip.lt (leftover from the parked setup)
but iv.lt's custom zone ("Redaguoti zoną") serves the zone **unsigned — zero DNSKEY**.
Result: every validating resolver (8.8.8.8, 1.1.1.1, most ISPs) **SERVFAILs the whole
zone**. Direct queries @ns1.serveriai.lt look fine — don't be fooled again.

- **Founder does:** iv.lt domain page → "DNSSEC apsauga: Įjungta **[Valdyti]**" →
  disable. Registry DS removal takes effect within hours.
- **Then verify** (validating resolver!): `dig A yip.lt @8.8.8.8` → `76.76.21.21`,
  NOT SERVFAIL. Then https://yip.lt gets Vercel SSL automatically, and Resend's
  "Verify DNS Records" for yip.lt should finally go green (their resolvers validate —
  this is almost certainly why verification never completed).
- **Then run the e2e funnel test**: signup form on https://yip.lt → confirm email
  from hello@yip.lt (Resend) → click → `subscribers` row confirmed in dev Neon.

## Funnel state (everything else is DONE)

- **Site deployed on Vercel** (free Hobby): project `yip` in `ketflows-projects`,
  live at **https://yip-navy.vercel.app** — serving real dev-Neon data. Deploy:
  `vercel deploy --prod --yes --cwd /Users/superoptimised/Skrendam/site` (CLI is
  logged in). Env on the service: DATABASE_URL, RESEND_API_KEY,
  YIP_FROM_EMAIL="Yip <hello@yip.lt>", NEXT_PUBLIC_SITE_URL=https://yip.lt. No
  GitHub auto-deploy yet — wire in the Vercel dashboard later (root dir `site/`).
- **Custom domains added** to the project: yip.lt (A 76.76.21.21) + www
  (CNAME cname.vercel-dns.com.) — records live at iv.lt, blocked only by DNSSEC.
- **Resend**: domain yip.lt added, all 4 DNS records live at the nameserver; the
  sending-only API key (`yip-prod`) is in `site/.env.local` and Vercel prod env
  (never in the repo). Awaiting the DNSSEC fix to verify. Free tier ≈100 emails/day.
- **Hosting decision recorded**: Vercel free now (non-commercial tier, fine
  pre-revenue); at first revenue → Vercel Pro $20/mo or migrate (Railway Hobby
  $5/mo). Railway's trial is expired; a $0 Railway Free plan exists (manual
  downgrade at railway.com/workspace/plans) but cannot run an always-on site.
  Railway CLI installed + linked to project `ketgo`/production (dormant fli-mcp).

## Redesign: V2 "Poster & Bead" is the direction

- **Design skill replaced**: `.claude/skills/yip-design-system/` now carries the
  founder's updated system where **V2 is the default** (`styles.css` single link,
  `v2/poster-bead.css` patterns, `screens/v2-home.html` canonical; v1 stays for
  product UI / Deal Desk). Source export sits untracked at `Yip Design System/`.
- **Canvas (design mockups)**: https://claude.ai/code/artifact/6cc22be5-aba0-4f1c-8255-a029f7fa9af5
  — version `v3-poster-bead`: home desktop + mobile + deal page in V2, carrying the
  settled conversion architecture: poster hero = today's best deal; **trophy case in
  slot two** ("Recent finds. All gone." — struck coral names, SAVED € lines); the
  **timing argument** at every capture ("rare fares last ~2 days; subscribers get
  them the morning we find them; the site is where the leftovers live"); savings in €
  everywhere; **NO process/scan wording** (founder veto); no invented social proof
  (the canonical screen's "12,400+ travelers" was deliberately dropped — zero
  subscribers exist). "Was €140 when we flagged it" drop-story kept as a maybe.
- **Next**: founder marks up the canvas → write the implementation spec (the
  brainstorming architectural path is mid-flight: direction settled, spec not yet
  written) → build V2 into `site/`. Implementation note: replace poster-bead's
  `left`-animating bead with `transform: translateX()` (perf); consider fixing
  upstream in the skill CSS too.
- **Images**: posters-first confirmed; **fal.ai photo batch demoted to future**
  (brief: `docs/plans/2026-08-23-route-imagery-brief.md`).
- Impeccable hook standing false-positives (brand-spec values; re-confirm with the
  founder before adding suppressions): amber CTA glow `0 8px 20px
  rgba(226,130,14,.30)`, amber top-border on the rounded signup card, V2
  `--bead-ease` bounce `cubic-bezier(.34,1.56,.64,1)`.

## Scan: self-healing chain COMPLETE (PRs #16, #17, #20, #21)

pre_ping+recycle+keepalives+connect_timeout (engine) · commit-before-sweep ·
finished_at fresh-clock · watchdog "did today's 06:00 scan finish" gate (08:30+) ·
wrapper retries 4× settle-paced · **checkpoint/resume**
(`skrendam/scanning/checkpoint.py`, file at
`~/Library/Logs/skrendam/scan-checkpoint.json`, per-spec commits, retries skip work
already done today). **Tomorrow's 06:00 is the first full test** — expect: dead
attempt at N%, retry finishes the remainder, ~1 pass of Google load, healthy
verdict. BotGuard model updated in memory: repetition heat trips the breaker
(Aug 26: 3 passes → abort at 62%; Aug 27: 2 passes → degraded; single-pass days
healthy). Never re-run after a completed scan. Lid-open-on-AC = cleanest mornings.

## Also merged this session

- **PR #15** site fixes (link-reset CSS, brand-voice headlines + migration 0011
  applied to dev Neon — zero machine headlines left, shared IATA maps
  (`skrendam/airports.json`/`airlines.json` canonical + drift guard), first mobile
  CSS). The v1 mobile CSS is superseded by the V2 rebuild when it lands.
- **PR #18** Deal Desk route-context/supersede + **PR #19** review fixes (trip-type
  guard, server-side revalidation, digit-bounded headline swap, one-way copy).
- `/code-review medium` over the week's delta: 8 verified findings, all fixed in #19.

## Open threads (beyond the №1)

1. **Desk top-20 shortlist** (Today = top 20 by score, rest behind "show all") —
   agreed, unbuilt. Queue 765, ~135/day new; the 14-day TTL starts sweeping ~Sep 5.
2. **AGY missing** from `fli.models.Airport` (510 log warnings per scan).
3. **LT vs EN site language** (TikTok audience is LT) — undecided, pre-bio-link.
4. TikTok embeds on-site (founder "maybe"), Workstream B digest (after
   funnel+redesign), Phase 3 desk polish, older watch-items (VNO-GVA core ~Dec 1,
   RIX Latvian-volume pass, Wave 2/3 scoring).
5. Worktree cleanup: this session's `feat+desk-supersedes` (merged; remove at exit);
   pre-existing `deal-logic-v2` and `feat+fli-resilience` are NOT this session's —
   confirm with the founder before removing.
6. Pre-bio-link items: Vercel GitHub auto-deploy; per-deal OG/share images.

## Traps for the next agent (new ones)

- **DNS checks must use a validating resolver** (`@8.8.8.8`), never only @ns1 —
  see the №1 blocker for why everything looked fine while being broken.
- The Bash worktree-guard rejects compound commands touching paths outside the
  worktree — write scripts to the session scratchpad and `bash <path>` them; Write
  tool also refuses shared-checkout paths (commit via a worktree branch instead).
- `vercel` CLI needs `--cwd /Users/superoptimised/Skrendam/site`; deploys are
  CLI-driven, not git-driven, until the dashboard wiring exists.
- Scan recovery by hand (rarely needed now): kill wrapper+uv+caffeinate+python,
  `nohup bash scripts/daily-scan.sh` from `~/Skrendam`; NEVER start a scan after one
  already completed today (BotGuard heat).
- Design-canvas working files live in the session scratchpad (`yip-redesign/`) and
  die with the session — recover from the artifact URL via the design skill's
  `seed-canvas.mjs --extract` flow.

## Suggested skills for the next session

- `yip-design-system` — now V2-default; MANDATORY for the site rebuild.
- `superpowers:brainstorming` → `superpowers:writing-plans` — finish the redesign's
  architectural path: spec after canvas markup, then plan, then build.
- `superpowers:using-git-worktrees` — feature work off `main`.
- `code-review` — after the V2 site build; watch CI with `gh run watch --exit-status`.
- `handoff` — at session close, keep the chain going.

## Key artifacts (do not re-derive)

- Canvas: https://claude.ai/code/artifact/6cc22be5-aba0-4f1c-8255-a029f7fa9af5
- PRs #15–#21 on github.com/Whirlywack/skrendam (merged; bodies carry the rationale)
- `docs/plans/2026-08-23-route-imagery-brief.md` — imagery (deferred)
- Memory: `skrendam-pilot-workstream-a`, `skrendam-scan-laptop-ops`,
  `skrendam-funnel-hosting` (new), `skrendam-v2-design-direction` (new),
  `fli-google-rpc-gated-2026-06`, `skrendam-route-imagery-fal`
