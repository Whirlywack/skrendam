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

**Brand:** warm Baltic-amber identity, "smart local travel club" feel, Lithuanian
copy (voice: tu-form, honest, numbers-first; product noun **radinys** — never
„pasiūlymas"; no hype words). Design direction **V2 "Poster & Bead"** — travel-poster
duotones, amber bead atom. Full system in `.claude/skills/yip-design-system/`.
Site H1 (since 2026-09-01): *"Randam pigius skrydžius, kad tau nereikėtų."*

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
5. **DataForSEO API** is available (as an MCP tool) to mine (a) long-tail
   keywords for the site and (b) travel topics with traction for TikTok
   content ideas. Verified LT volumes (2026-08-29): "paskutinės minutės
   kelionės" 4,400/mo, "savaitgalio kelionės" 2,900/mo (both package-intent,
   HIGH competition), "pigūs skrydžiai" 2,400/mo, "žiemos atostogos" 390
   (peak 1,300 Jan), "slidinėjimo kelionės" 210 (peak Jan), "kur keliauti
   lapkritį" 40 (peaks Sep–Oct). The literal "kur šilta X" phrases are ~zero.
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
                    └─ newsletter (Resend; NOT yet live — see §6)
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

## 4. Repo map

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

## 5. Hard-won operational truths (do not relearn these)

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

## 6. Current state (2026-09-03) and next missions

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
