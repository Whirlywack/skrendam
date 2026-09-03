# Yip / Skrendam — the project, in one file

> Read this first. It is the canonical "what is this, how does it work, what have
> we learned" document — written 2026-09-03 so that a fresh session (or a fresh
> person) never needs the story re-explained. CLAUDE.md covers the codebase
> mechanics; this covers the product, the pipeline, and the hard-won operational
> truths. Update it when a decision changes; date every update.

---

## 1. What this is

**Yip** (live at **https://yip.lt**) is a human-curated cheap-flight-deals service
for Lithuania and the near Baltics. A machine scans Google Flights daily for
fares from **Vilnius (VNO), Kaunas (KUN), Riga (RIX)**; a human curator reviews
the finds in an internal Deal Desk and publishes only genuinely good ones —
each with *why it's good* and *what the catch is* (LT: „kodėl verta ir koks
kabliukas"). Yip is **not a search engine**: users don't search, they subscribe.
The internal codename for the venture is **Skrendam** (the repo name).

**Brand, voice, and design:** everything lives in the design-system skill —
`.claude/skills/yip-design-system/` (use it for ALL UI, asset, and brand-copy
work; current direction is V2 "Poster & Bead"). The LT copy deck is
`site/src/lib/lt.ts`; its header carries the voice rules.

## 2. The business plan (founder's words, 2026-09-03)

Stage 1, in order:

1. **TikTok first.** The initial audience channel is TikTok (Lithuanian content).
   Deals get *sent* later; at the start TikTok builds reach.
2. **Mailing list → subscription service.** Collect emails on yip.lt (free
   weekly letter + optional instant alerts), later a paid tier. The
   **edition-scarcity model** is founder-approved: the site shows the top 1–2
   deals free, the rest are locked rows ("kaina — laiške") — subscribers see
   everything.
3. **Leads as an asset.** The list is people interested in travel — to be
   leveraged beyond flight deals later.
4. **SEO-friendly frontend** (already live) so organic search compounds:
   origin pages own the head terms ("pigūs skrydžiai iš Vilniaus"), collection
   pages target seasonal mid-tail terms.
5. **DataForSEO API** (wired in as an MCP tool) is the ongoing research
   instrument, not a one-off: mine long-tail keywords for site pages AND
   travel topics with traction for TikTok content ideas, continuously — the
   keyword space is open-ended, don't anchor on any fixed list. A first
   sample survey (with takeaways) is archived in
   `docs/research/2026-08-29-lt-keyword-volumes.md`.
6. **fli is stage 1 of data.** Flight data comes from the vendored `fli`
   library (reverse-engineered Google Flights API — direct RPC, not scraping).
   Something better may replace it later; everything upstream is built to keep
   the data source swappable (the Next.js apps never fetch flights themselves —
   only the Python worker talks to Google).

## 3. How the machine works (pipeline)

```
fli (Google Flights RPC)
   └─ daily scan, 06:00 EEST, launchd on the founder's MacBook  (skrendam/)
        └─ 159 routes (29 core daily + tail cohorts), 14 deal templates
        └─ scoring: weighted gates + MAD outlier scorer, month-local baselines
        └─ writes: price_log, candidates, matches, drafts → Neon Postgres
              └─ Deal Desk (web/, Next.js, port 3000): Review → publish
                    └─ published_deals → public site (site/, Next.js, yip.lt)
                    └─ newsletter (Resend; NOT yet live — see §7)
```

- **Database:** Neon Postgres, project `yip` (`still-mode-83548775`). ⚠️ The
  active DB is the **`dev` branch** (`br-cool-hill-agqjm1kk`); the `production`
  branch is idle/empty. Everything (desk, site, scan) points at dev.
- **Templates = deal archetypes.** 14 of them (audience × travel moment ×
  date window × destination scope × price gates). Restructured 2026-08-29
  ("moment-structure audit", PR #30): plan-ahead-summer is seasonal Jun–Aug
  + 60-day lead; last-warm-days split Oct (broad Med) / Nov (verified-warm
  destinations only); winter-sun starts Dec 1; Christmas markets open Nov 20;
  weekend template hard-gates FRI/SAT departures; three fixed-window family
  templates track the official LT school breaks (**yearly chore:** refresh
  their dates each June from smsm.lrv.lt; the desk Coverage tab flags stale
  ones). The desk's **Machine → Coverage** tab renders the whole map.
- **Seeds are insert-only** (`skrendam/seeds.py`): value changes to existing
  rows need one-off SQL on the live DB (pattern: `scripts/2026-08-29_*.sql`).
- **Site** (yip.lt): V2 Lithuanian Poster&Bead design, LIVE since 2026-08-28.
  Vercel, auto-deploy: PR previews + prod on merge to main. Boarding-pass deal
  pages, collections (3 origin + 3 moment), /past-deals trophy case, gated
  double-opt-in signup. Copy deck: `site/src/lib/lt.ts` (single source).

## 4. How deals are classified (the taxonomy)

Every fare that becomes a deal passes through this classification stack —
it's the heart of the product:

- **Zones** (8): `WESTERN_EUROPE, MEDITERRANEAN, SCANDINAVIA, CANARIES,
  CITY_BREAKS, LONG_HAUL, MIDDLE_EAST, CAUCASUS`. Every route belongs to one
  zone; zones carry the default price gates (threshold €, min abs savings,
  min discount %) that templates fall back to.
- **Routes** (159): origin×destination pairs seeded in `skrendam/seeds.py`.
  ~29 are **core** (scanned daily); the tail rotates in cohorts
  (`id % N == day-ordinal % N`, default width 10) to fit the Google budget.
- **Audiences** (6): families, couples, flexible_adults, budget, city_break,
  vfr — each with an itinerary-strictness default.
- **Travel moments** (10): the marketing concepts — school_holidays,
  sept_shoulder, last_warm_days, xmas_markets, last_minute,
  plan_ahead_summer, vfr_visit, long_haul_chance, winter_sun, ski_season.
- **Deal templates** (14): the operational unit = audience × moment × date
  window (relative / seasonal / seasonal+lead / fixed) × destination scope
  (zones or an explicit list) × price gates × itinerary rules. A moment can
  have several templates (last_warm_days has Oct-broad + Nov-warm-only;
  school_holidays has summer + three fixed-date break templates). A fare
  attaches to EVERY template whose scope+window+gates it satisfies — that's
  by design; the desk shows supersede/route-context chips for duplicates.
  **The live map of all of this is the desk's Machine → Coverage tab.**
- **Scoring & tiers:** two scorers run per fare (weighted gates blend + a
  MAD-based outlier z-score), both against month-local baselines from
  `price_log`. Score is normalized 0–100: **great ≥ 88**, **rare ≥ 94**
  (site shows „Geras radinys" / „Retas radinys"); z ≤ −5 with ≥30% discount
  flags a possible error fare.
- **Candidate lifecycle:** `new` (in Review) → curator action: publish (→
  `published_deals`, status live), reject, or save; `expired` when the travel
  date passes or the fare disappears (expiry sweep). Published deals carry
  freshness ("going fast" chip) and are re-checked before being trusted.
- **Desk filtering (web/):** Today = top-20 shortlist; Review = all `new`
  candidates filtered by origin-city chips (Vilnius/Kaunas/Riga) × moment
  chips × best-first sort; Live = published board; Machine = config
  (templates, routes, zones, audiences, moments, scan health, coverage).
- **Site collections (site/):** public landing pages over published deals via
  three filter kinds — **origin** (`publishedDeals.origin`), **zone**
  (`publishedDeals.zone`), **moment** (moment → its templates → deals).
  Currently 6 pages (3 origin + Sept-sun, Xmas-markets, Cyprus). ⚠ the Cyprus
  page filters the whole MEDITERRANEAN zone — fix when collections are next
  touched. Moment collections automatically aggregate all of a moment's
  templates, so the school-break and last-warm splits need no site changes.

## 5. Repo map

| Path | What |
|---|---|
| `fli/` | Vendored Google Flights client (private fork; no releases) |
| `skrendam/` | Scan engine: resolver, orchestrator, scorers, seeds, adapters |
| `web/` | Deal Desk (internal curation app, Next.js + drizzle) |
| `site/` | Public yip.lt (Next.js), LT copy deck in `src/lib/lt.ts` |
| `scripts/` | daily-scan.sh wrapper, watchdog (status.sh), launchd plists, one-off SQL |
| `docs/handoffs/` | Session-close handoffs (chronological truth) |
| `docs/plans/` | Approved specs (V2 site spec: `2026-08-28-v2-lt-site-spec.md`) |
| `.claude/skills/yip-design-system/` | Brand + design system (use for ALL UI/copy work) |

## 6. Hard-won operational truths (do not relearn these)

- **The scan runs on the founder's MacBook; macOS sleep is enemy #1.**
  Scheduled 05:58 wake full-wakes only on AC; clamshell needs AC + external
  display. Self-healing chain: keepalives fail-fast → 4× settle-paced retries →
  daily checkpoint/resume (`~/Library/Logs/skrendam/scan-checkpoint.json`) so
  retry mornings cost ~1 pass of Google load. Watchdog notifies after 08:30.
- **ProtonVPN is enemy #2 and it impersonates BotGuard** (learned the hard way,
  2026-08-30→09-03): scans through a VPN exit IP get 100% empty calendar
  responses (+ occasional 429s), and VPN DNS breaks Neon hostname resolution.
  Check `scutil --nc list` + `curl api.ipify.org` **before** diagnosing Google
  gating. A VPN-gated run poisons the day's checkpoint — move the file aside
  before a clean retry. Auto-connect must stay off.
- **Google/BotGuard:** cold single-pass daily scanning from a residential IP is
  healthy (~96–100% answer rate). Never probe the endpoint interactively; never
  rescan after a completed healthy run; irregular repeated attempts = gating.
- **A fare attaches to every matching template** (by design) — the desk shows
  route-context/supersede chips to manage duplicates.
- **`trip_len_max_days` is decorative:** the resolver searches only
  `trip_len_min_days` per round-trip spec (Google-load trade-off, conscious).
- **Honesty is a product rule:** show the catch, no invented social proof, no
  "scan" wording on the public site, reference-price claims obey the
  `WAS_PRICE_MIN_DROP_PCT` depth gate everywhere.
- **Process rules:** feature work in git worktrees off main; founder-approved
  mockups (with REAL data states) before any design build; copy approval ≠
  design approval; `gh run watch --exit-status` (not `pr checks --watch`) to
  gate merges.

## 7. Current state (2026-09-03) and next missions

**Working:** daily scan healthy (2026-09-03: 912 calls, 0×429, 152 candidates,
first full harvest on the new template structure — weekend gate 7/7 Fri/Sat,
first school-break finds). Site live with blink-test-passing copy. Desk has
Today/Review/Live/Machine + Coverage. DataForSEO + Neon MCP wired into sessions.

**Not yet done (the queue):**
1. **Wire the site to live deals** — publish steadily from Review (~1,400
   labeled candidates), expire dead ones. The site currently shows very few
   live deals; this blocks everything growth-shaped.
2. **Email go-live:** Resend domain verify + first end-to-end signup test;
   first newsletter issue should ship close behind the scarcity model.
3. **PR C leftovers** (privacy page, sample issue, curator quote, inner-page
   V2 polish, 3 unapproved conversion patches).
4. **Collections, staged** (founder-agreed 2026-08-29): when live deals flow —
   *Savaitgaliai* + *Paskutinės šiltos dienos* (mockups → sign-off → build);
   November: *Žiemos saulė* + ski (after ~Dec 1 GVA/TRN core flip). Fix the
   Kipras collection's zone filter (matches all MEDITERRANEAN) whenever
   collections are touched. Family/school-break stays newsletter-only for now.
5. **TikTok content pipeline** — not started in-repo; DataForSEO topic mining
   is the intended research tool.
6. **Later:** move scanning off the founder's laptop (must stay on a
   residential IP); consider replacing fli (stage 2).

**Where deeper history lives:** `docs/handoffs/` (session-by-session),
`docs/plans/` (specs), Claude's memory directory (cross-session facts, indexed
in its MEMORY.md). The most recent full handoff before this file:
`docs/handoffs/2026-08-28-v2-ship-session-close.md`.
