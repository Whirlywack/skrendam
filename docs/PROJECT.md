# Yip / Skrendam — the project, in one file

> Read this first. It is the canonical "what is this, how does it work, what have
> we learned" document — written 2026-09-03 so that a fresh session (or a fresh
> person) never needs the story re-explained. CLAUDE.md covers the codebase
> mechanics; this covers the product, the pipeline, and the hard-won operational
> truths. Update it when a decision changes; date every update.
> Last updated 2026-09-11 (WP6 email streams).

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
        └─ 169 routes (39 core daily + tail cohorts), 18 deal templates
        └─ scoring: weighted gates + MAD outlier scorer, month-local baselines
        └─ writes: price_log, candidates, matches, drafts → Neon Postgres
              └─ Deal Desk (web/, Next.js, port 3000): Review → publish
                    └─ published_deals → public site (site/, Next.js, yip.lt)
                    └─ email (Resend, sent FROM the desk — see "Email streams")
                          ├─ instant: publish → every paid subscriber, same minute
                          ├─ paid digest: Thursday, assembled + sent on /letters
                          └─ free nurture: every ~10 days, assembled + sent on /letters
                                └─ links → site /go, /uzsisakiau → deal_events
```

- **Database:** Neon Postgres, project `yip` (`still-mode-83548775`). ⚠️ The
  active DB is the **`dev` branch** (`br-cool-hill-agqjm1kk`); the `production`
  branch is idle/empty. Everything (desk, site, scan) points at dev.
- **Templates = deal archetypes.** 18 of them (audience × travel moment ×
  date window × destination scope × price gates). Restructured 2026-08-29
  ("moment-structure audit", PR #30): plan-ahead-summer is seasonal Jun–Aug
  + 60-day lead; last-warm-days split Oct (broad Med) / Nov (verified-warm
  destinations only); winter-sun starts Dec 1; Christmas markets open Nov 20;
  weekend template hard-gates FRI/SAT departures; **four** fixed-window family
  templates track the official LT school breaks (autumn, February, Easter and
  — added 2026-09-10 — Christmas); **three fixed-window `home-*` templates**
  (WP7, 2026-09-10) watch the reverse-diaspora routes in the Christmas / Easter /
  summer home windows. The desk's **Machine → Coverage** tab renders the whole
  map.
- **`peak_windows`** (added 2026-09-10, WP2): the calendar's normally-expensive
  stretches (school breaks, public holidays, long weekends, custom "home for
  Christmas" ranges) with the persona codes each appeals to. The demand layer
  compares a fare with history from the SAME window instead of the month's
  median — that is what makes a Christmas-peak fare findable as a deal.
  **Yearly chore (each June):** refresh BOTH the family templates' fixed
  windows AND the `peak_windows` rows from smsm.lrv.lt — they are seeded from
  the same `LT_*_BREAK` constants and must move together (a peak window opens
  on the Friday before its break, matching the template's departure window).
  The desk Coverage tab flags stale template windows.
  **Yearly chore (each March) — 2027-03-01: run
  `scripts/2027-03-01_enable_home_summer.sql`** to switch on `home-summer`
  (seeded `enabled=False` so its ~10 specs/day are not spent nine months
  early); then roll the three `home-*` fixed windows and the `home-*`
  `peak_windows` rows forward a year, same as the June chore.
- **Seeds are insert-only** (`skrendam/seeds.py`): value changes to existing
  rows need one-off SQL on the live DB (pattern: `scripts/2026-08-29_*.sql`).
- **Site** (yip.lt): V2 Lithuanian Poster&Bead design, LIVE since 2026-08-28.
  Vercel, auto-deploy: PR previews + prod on merge to main. Boarding-pass deal
  pages, collections (3 origin + 3 moment), /past-deals trophy case, gated
  double-opt-in signup. Copy deck: `site/src/lib/lt.ts` (single source).
- **Email streams** (WP6, 2026-09-11, migration `0014_email_streams`). Sending
  lives in the **desk** (`web/src/lib/email/`), not on Vercel — there is no
  always-on host, so **there is no scheduler: Thursday is a calendar habit.**
  Two streams, split by `subscribers.plan` (`'free'` | `'paid'`):
  - **Instant (paid):** `publishDeal` fires `sendInstant` — every confirmed,
    not-unsubscribed **paid** subscriber whose `prefs.origins` includes the
    deal's origin gets „{price} € — {Miestas}" within the minute. A send
    failure never fails the publish; the deal is live regardless.
  - **Paid digest (Thursday 07:00, by hand):** desk **Letters** page
    (`/letters`) → *Assemble* picks live deals published since the last
    digest → preview (iframe) → *Send* to `plan = 'paid'`.
  - **Free nurture (every ~10 days, by hand):** same page → 2 fresh live
    deals under „Savaitės radinys" + 3 recently expired under „Ką praleidai"
    with the real price, how long it lasted and „{n} prenumeratorių užsisakė"
    (real `deal_events` counts only) + one upgrade link → `plan = 'free'`.
  Every send is an `issues` row (`kind`, `sent_at`, `deal_ids`, `stats`);
  without `RESEND_API_KEY` the row is still written with
  `stats.skipped_no_key` so the e2e journey keeps publishing. Recipients only
  ever come from `activeSubscribers(plan)`; every mail ends with the
  `/atsisakyti` link and sets `List-Unsubscribe`. Renderers are LT
  (`web/src/lib/email/render.ts`, copy in `copy.ts` — spec §7 verbatim,
  banned words enforced by test; „įprastai" only when discount ≥ 30%).
  **Tracking:** every deal link is `site/go/<deal>?i=<issue>&s=<refCode>`
  (records a `click` deal_event, 302s to the booking URL) and every card
  carries a „Užsisakiau" link to `/uzsisakiau/<deal>` (POST button records
  one `booked_claim` per subscriber per deal). **Subscribers** page
  (`/subscribers`): everyone newest first with their signup prefs, referral
  counts, and the **manual plan flip** — the Payment Link phase has no
  webhook, the curator flips a row to paid when the payment lands
  (`paid_source = 'manual'`, early alerts on). **Env (`web/.env.local`):**
  `RESEND_API_KEY` (unset = every send a no-op), `YIP_FROM_EMAIL` (default
  `Yip <hello@yip.lt>`), `NEXT_PUBLIC_SITE_URL` (default `https://yip.lt` —
  empty counts as unset), `PAYMENT_LINK_URL` (unset = no upgrade block).
  One-off after 0014: `scripts/2026-09-12_founding_interest_backfill.sql`
  flags pre-existing early opt-ins as founding interest (shown on the
  Subscribers page, kept for the manual first upgrade ask — the nurture does
  not read it). First-send
  checklist: `docs/handoffs/2026-09-11-wp6-email-streams.md`.

## 4. How deals are classified (the taxonomy)

Every fare that becomes a deal passes through this classification stack —
it's the heart of the product:

- **Zones** (9): `WESTERN_EUROPE, MEDITERRANEAN, SCANDINAVIA, CANARIES,
  CITY_BREAKS, LONG_HAUL, MIDDLE_EAST, CAUCASUS, HOME_VFR`. Every route
  belongs to one zone; zones carry the default price gates (threshold €, min
  abs savings, min discount %) that templates fall back to. **`HOME_VFR`**
  (WP7, 2026-09-10; gates as `WESTERN_EUROPE`: €50 / €25 / 25%) exists only
  to hold the reverse-diaspora routes: a route's zone decides which
  zone-filtered templates scan it, and `christmas-markets` +
  `last-minute-weekends` filter on `CITY_BREAKS`/`WESTERN_EUROPE` with no
  destination filter — reverse routes seeded there would be scanned by both
  every day (~+115 api_calls, over the ~900 envelope). **No zone-filtered
  template may ever reference `HOME_VFR`** (`test_seeds.py` enforces it); only
  the `home-*` templates reach it, via `included_zones=["HOME_VFR"]`.
- **Routes** (169): origin×destination pairs seeded in `skrendam/seeds.py`.
  ~39 are **core** (scanned daily); the tail rotates in cohorts
  (`id % N == day-ordinal % N`, default width 10) to fit the Google budget.
  Origins are VNO/KUN/RIX (pilot scope, no TLL) **plus, since WP7
  (2026-09-10), ten reverse routes with the origin abroad** — Lithuanians
  living in the UK/Ireland/Nordics flying home: `STN→KUN, STN→VNO, LTN→KUN,
  LTN→VNO, DUB→KUN, DUB→VNO, OSL→VNO, CPH→KUN, BGO→VNO, LPL→KUN`, all core,
  zone `HOME_VFR`. Every pair has a public schedule source (research
  `.superpowers/sdd/2026-09-10-demand-layer-implementation-plan/wp7-research.md`);
  the spec's OSL→KUN, BGO→KUN and MAN→KUN were dropped as not operating.
  Never verify routes by scanning — schedule facts come from the research.
- **Audiences** (6): families, couples, flexible_adults, budget, city_break,
  vfr — each with an itinerary-strictness default.
- **Travel moments** (10): the marketing concepts — school_holidays,
  sept_shoulder, last_warm_days, xmas_markets, last_minute,
  plan_ahead_summer, vfr_visit, long_haul_chance, winter_sun, ski_season.
  Distinct from these are the **subscriber moment preferences** the site's
  signup offers (`site/src/lib/subscribe-prefs.ts` `PREF_MOMENTS`): sun, city,
  family, weekend, last_minute and — since WP7 (2026-09-10) — **`home`
  („Grįžtu namo iš užsienio")**. A template's `newsletter_tag` maps to pref
  codes through `personas.json` (identical copies in `skrendam/`, `web/`,
  `site/`; drift-tested): both `vfr` and `home` tags → `["home"]`, so a
  subscriber who picks `home` receives the `home-*` finds and the existing
  `vfr-watch` ones.
- **Deal templates** (18): the operational unit = audience × moment × date
  window (relative / seasonal / seasonal+lead / fixed) × destination scope
  (zones or an explicit list) × price gates × itinerary rules. A moment can
  have several templates (last_warm_days has Oct-broad + Nov-warm-only;
  school_holidays has summer + four fixed-date break templates; vfr_visit has
  `vfr-watch` + the three WP7 **`home-*`** templates — `home-xmas` „Kalėdoms
  namo" 2026-12-18→2027-01-06, `home-easter` „Velykoms namo"
  2027-03-25→04-05, `home-summer` „Vasarai namo" 2027-06-20→07-05; all
  `audience=vfr`, `newsletter_tag=home`, `included_zones=[HOME_VFR]`,
  `included_destinations=[VNO,KUN]`, priority 100, windows copied from the
  `home-*` `peak_windows` rows; **`home-summer` is seeded disabled** until the
  March chore flips it). A fare
  attaches to EVERY template whose scope+window+gates it satisfies — that's
  by design; the desk shows supersede/route-context chips for duplicates.
  **The live map of all of this is the desk's Machine → Coverage tab.**
- **Scoring & tiers:** scorers run per fare (weighted gates blend + a MAD-based
  outlier z-score, plus price-drop/rarity/error-fare strategies), all against
  month-local baselines from `price_log`. Score is normalized 0–100: **great ≥
  88**, **rare ≥ 94** (site shows „Geras radinys" / „Retas radinys"); z ≤ −5
  with ≥30% discount flags a possible error fare.
- **Demand layer** (`score_v2`, added 2026-09-10, WP2): scorers only ADD
  matches, so a second pure pass re-ranks and DEMOTES. It takes the headline
  score and applies: a **commodity cap** (40) when the fare sits on its own
  90-day floor on ≥20% of scan days; a **date-fit** multiplier (peak window
  1.25, Fri/Sat–Sun/Mon weekend 1.10); a **demand weight** by destination tier
  (A 1.00 / B 0.85 / C 0.70, VFR corridors count A for the "home" persona);
  and an **archetype** — `date` > `rare` > `destination` — naming why the fare
  is interesting (a commodity fare gets none). **A match's `quality_tier`
  follows `score_v2`, not the headline score**, so a headline-great fare to a
  low-demand destination is not tiered great. Pre-migration-0012 rows have a
  NULL `score_v2` and are the only ones read-side fallbacks may re-derive.
- **Candidate lifecycle:** `new` (in Review) → curator action: publish (→
  `published_deals`, status live), reject, or save; `expired` when the travel
  date passes or the fare disappears (expiry sweep). Published deals carry
  freshness ("going fast" chip) and are re-checked before being trusted.
- **Desk filtering (web/):** Today = top-20 shortlist; Review = all `new`
  candidates filtered by origin-city chips (one per enabled route origin —
  Vilnius/Kaunas/Riga plus the abroad WP7 origins, labelled from
  `airports.json` via `originLabels()` — origins sharing a city name carry
  the code, „London STN" / „London LTN"; IATA code as fallback) × moment
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
- **`tests/search` must NEVER run from the scan laptop.** It hits Google
  Flights for real; whole-repo pytest during review waves cost two DEGRADED
  daily scans (2026-09-09/10: 85% empties + 429s). PR #39 (open, not yet
  merged) gates `tests/search` behind `--live`; **until it merges, never run
  whole-repo `pytest` from the scan laptop** — `uv run pytest tests/skrendam`
  is the only safe default.

## 7. Current state (2026-09-11) and next missions

**Working:** daily scan healthy (2026-09-03: 912 calls, 0×429, 152 candidates,
first full harvest on the new template structure — weekend gate 7/7 Fri/Sat,
first school-break finds). Site live with blink-test-passing copy. Desk has
Today/Review/Live/Machine + Coverage. DataForSEO + Neon MCP wired into sessions.
**Shipped 2026-09-10:** WP0 (PR #35) and WP2 — the demand layer (PR #36):
`peak_windows`, `score_v2`/`archetype`/`demand_signals` on every match,
time-of-day gates enforced, `family-xmas-sun`, and `skrendam analyze
--labels`; WP3 (PR #38, desk Today by `score_v2`). **WP6 (2026-09-11, branch
`feat/wp6-email-streams`):** the two email streams, Letters + Subscribers
pages, `/go` + `/uzsisakiau` tracking, `deal_events` — see §3 "Email
streams". Code-complete; **not yet sending** until the founder works through
the first-send checklist (`docs/handoffs/2026-09-11-wp6-email-streams.md`).

**Not yet done (the queue):**
1. **Wire the site to live deals** — publish steadily from Review (~1,400
   labeled candidates), expire dead ones. The site currently shows very few
   live deals; this blocks everything growth-shaped.
2. **Email go-live (founder, first-send checklist in the WP6 handoff):**
   Resend domain + SPF/DKIM/DMARC for yip.lt, keys into `web/.env.local`,
   Stripe Payment Link, test sends to Gmail/Apple Mail/Outlook, run the
   founding-interest SQL, first end-to-end signup test; then the first
   Thursday digest. RFC 8058 one-click (`List-Unsubscribe-Post`) is a later
   item.
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
