# yip.lt — page inventory for the site redo (2026-09-12)

Status: inventory, not a plan. Grounded in the live site (curl 2026-09-12 ~15:30), `site/src` on
`main` (15abd14), and read-only queries against the Neon dev branch. Feeds phase (a) (show the backend)
now and phase (b) (SEO architecture, `docs/research/2026-09-11-site-sitemap-seo-architecture.md`) once
the deep research is in.

## 1. Data reality today (drives what a page may honestly claim)

| Fact | Value | Consequence |
|---|---|---|
| Distinct scan-days in `price_log` | **24** (first 2026-06-03; the 70-day TCC outage ate the summer) | "180-day price history" is not true yet. Route pages can claim „per paskutines N patikras", not 180 days. |
| Routes with ≥ 14 scan-days (the programmatic floor) | **24 of 169** (VNO 10, RIX 9, KUN 5; home routes 0) | Phase (b) route pages start at 24 and grow with every healthy scan; ~1 new eligible route/day per origin as the tail catches up. |
| Distinct destinations in `routes` | 105 (106 in `cities-lt.json`) | Destination pages are gated by the same floor; a handful qualify today. |
| Published deals | 12 live · 0 changed · 5 expired · 1 draft | Changed state has never occurred in prod data; the mockup must still show it. |
| Live deals with `verified_at` / `deal_price_checks` rows | **0 / 0** | WP9 has not had a healthy run since merge (09-11, 09-12 scans failed). The site's freshness label currently falls back to `last_seen_at`. |
| Live deals with a curator body | 1 of 12 | "Curator's note" block is empty on 11 of 12 deal pages. |
| Live deals with `going_fast` | 0 | |
| Expired deals with `expired_at` | 5 of 5, avg lasted 203 h, min 0 h | „išbuvo N val." is computable today; a 0 h row needs a floor/label rule. |
| Letters sent (`issues.sent_at`) | 0 | Newsletter archive has nothing to show yet; `S.issueLabel` on the home says „Laiškas Nr. 1" as static copy. |
| `deal_events` | 1 click | „N užsisakė" proof blocks stay hidden until real counts exist. |
| Subscribers | 0 | |

## 2. Current pages (17 routes) — what each renders, SEO state, gap vs backend

Legend: ✅ renders · ⚠ partial/wrong · ✗ missing. "Backend field" = exists in DB and/or mappers.

### `/` home — `app/page.tsx`, ISR 300 s
- Renders: masthead, kicker (static „Laiškas Nr. 1 — vėlyva vasara"), H1, human stamp + freshness,
  Poster (deal #1 with price, strikethrough baseline if drop ≥ threshold, „sutaupai X €", changed
  price lines, catch chip · dates · airline · freshness), CaptureRow, TrophyCase (3 expired),
  LiveIndex (deals 2–3 full, 4–12 locked: destination + month + stops chip), InkBand, footer.
- SEO: title/description/OG text ✅; OG image ✗ (no `public/` at all); favicon ✗ (404);
  Organization + WebSite JSON-LD ✅; `ItemList` ✗.
- Gaps vs backend: kicker is hardcoded, not tied to `issues`; „atnaujinta šįryt" is a string, not
  `verified_at`/`last_seen_at`; archetype / window / family saving mapped but unrendered;
  trophy rows lack „išbuvo N val." (`expired_at` exists).

### `/deal/[id]` — `app/deal/[id]/page.tsx`, ISR 300 s
- Renders: breadcrumb (visible + JSON-LD), poster hero (rank „Nr. 0X", quality stamp, headline,
  price + was + saving + changed lines, booking CTA), catch line, „Kodėl verta / Kabliukas" columns,
  curator note (if body), price context (percentile over 90 d when ≥ 14 samples, else „N % pigiau"),
  sparkline, CaptureRow, 3 similar deals (free-window only), LinkBand to origin/destination/zone
  collections, InkBand.
- States: locked (live outside free window) → 307 to `/#kapote` + noindex metadata ✅; expired →
  200 + noindex,follow ✅ (matches the SEO doc) but no link to a route page (none exists) and no
  „išbuvo N val." ⚠.
- SEO: title carries price ✅; `Article` JSON-LD (price-free) ✅; `Offer` ✗ (deliberate so far —
  revisit with research §3); canonical ✅.
- Gaps: verified-ago stamp uses the freshness label but no explicit „patikrinta prieš N val."
  line; `groundHint` mapped, unrendered; `windowMinPrice`/`windowMinDate` unrendered; price-check
  history (`deal_price_checks`) unrendered; archetype verdict unrendered.

### `/past-deals` — archive, ISR 300 s
- Renders: 48 expired rows (month, destination, route · saved · dates, price + was).
- SEO: title/description/canonical ✅; slug is English (doc proposes `/buvo` + 301).
- Gaps: no „išbuvo N val.", no link to route/destination, no `ItemList`.

### `/collections` + `/[slug]` (6 static collections) — ISR 300 s
- 3 origin hubs (`/pigus-skrydziai-is-vilniaus|-kauno|-rygos`, LT slugs ✅) + 3 moment/zone
  collections with **English slugs** (`september-sun-deals`, `christmas-market-flights`,
  `cyprus-flight-deals-from-lithuania`) ⚠.
- Renders: hero + count line („Šiuo metu: N gyvi · dar M tik laiške"), DealRow list (free window
  only), sibling LinkBand, breadcrumb JSON-LD ✅. Empty state is honest ✅.
- Gaps: index page `/collections` is not an LT slug; only 3 of 10 `travel_moments` have a page;
  Kipras zone filter bug noted in PROJECT.md; no `ItemList` schema; no FAQ; no price-history
  content (these are lists, per the doc that is correct — route pages carry the content).

### Funnel
- `/subscribe` (5 server states: idle / check-email / confirmed+prefs / upsell / early-joined /
  error) — V1 Header/Footer, not V2 ⚠; title ✅; no canonical.
- `/early-alerts` — V1 dress ⚠; canonical ✅; it is a paid waitlist, copy says so ✅.
- `/confirm` (route) — disallowed in robots ✅.
- `/uzsisakiau/[dealId]` — noindex ✅; „Kaina pasikeitė" reader signal ✅.
- `/atsisakyti` (+ `/ok`, `/klaida`) — noindex ✅.
- `/go/[dealId]` — tracked redirect, disallowed ✅.
- `/privatumas` — canonical ✅.

### Site-wide
- `robots.ts` ✅ (AI bots allowed); `sitemap.ts` single file: static + collections + free-window
  deals ✅. Split sitemaps ✗. `llms.txt` ✗ (404). `/apie`, `/kaip-veikia`, `/duk` ✗ (404).
- Masthead nav = Radiniai · Kryptys only (IA decision 08-28). Footer: collections, 3 origins,
  past deals, privacy. No about/how-it-works link anywhere.
- Fonts from Google Fonts in `layout.tsx` ✅. Security headers ✅. Redirects: 3 old EN origin
  slugs → LT ✅.
- No `public/` directory → no favicon, no OG image, no logo file, no `.ics`.

## 3. Phase (a) gap list — backend produces it, site does not show it

| Backend field / state | Where it should appear | Today |
|---|---|---|
| `verified_at` (WP9) as an explicit „patikrinta prieš N val." stamp | poster catch line, deal page, rows | folded into a generic freshness label |
| `current_price` vs `price` (changed state) | poster, deal page, rows | mapped + rendered as two mono lines ✅ but never seen with real data; needs the mockup |
| `expired_at` → „išbuvo N val." | trophy case, past-deals, expired deal page | not rendered |
| `deal_price_checks` history | deal page (a small „patikrinom 09-10 · 09-11 · 09-12" strip) | not rendered, table empty until a healthy scan |
| `window_min_price` / `window_min_date` | deal page catch column („pigiausia diena lange: …") | not rendered |
| archetype (`date` / `rare` / `destination`) | verdict line wording; poster stamp | mapped, unrendered |
| `demand_signals.window_slug` | deal page moment link („tinka: Kalėdų mugės"), moment collection membership | unrendered |
| `demand_signals.saving_family` | family deals only („šeimai iš keturių sutaupai X €") | unrendered |
| `groundHint` (KUN/RIX from Vilnius) | deal page catch column | unrendered |
| `issues` (sent letters) → real edition number | home kicker | hardcoded string |
| `deal_events` booked counts | proof block | hidden until counts exist (correct) |
| Curator body on 1/12 deals | deal page | block hides when empty; the mockup must show the empty state |

## 4. Phase (b) target inventory (from §0.1) with today's viability

| Layer | Page | Count today / eventual | Blocked by |
|---|---|---|---|
| A | home, `/deal/[id]`, archive, 3 origin hubs, funnel/legal | exists | phase (a) polish; LT slugs for `/collections` and `/past-deals` (301s) |
| B | route page `/skrydziai/{origin}-{dest}` | **24 eligible now** / 169 | history floor grows daily; research decides slug shape and titles |
| B | destination page `/kryptys/{city}` | few / ~105 | same floor, aggregated per city |
| B | flights-home `/namo/is-{city}` + hub | 0 eligible / 10 routes | WP7 routes have 1 scan-day; not before ~Oct |
| B | airport pages ×3 | static content | copy only |
| C | moment pages (10 `travel_moments`, 3 have a collection) | 3 / 10+ | LT slugs; `kur-keliauti-lapkriti` and `savaitgalio-keliones` are not moments in the DB yet (need a filter definition or editorial page) |
| C | school-holidays page + `.ics` lead magnet | 0 | needs `public/` or a route handler generating the `.ics`; double-opt-in delivery hook in WP6 |
| D | `/apie`, `/kaip-veikia`, `/duk` | 0 | copy; FAQPage schema |
| D | `/laiskai/[n]` letter archive | 0 letters sent | first send |
| D | `/kainu-indeksas` | needs a quarter of data | data depth |
| D | `/kaina` paid page | 0 | Payment Link + legal (research §7) |
| — | `/is-tiktok` landing | 0 | copy + mockup; attribution already lands in `prefs.utm` |
| — | `llms.txt`, split sitemaps, favicon/OG image, `Organization.logo` | 0 | small, no dependency — hygiene slice |

## 5. Hygiene found on the way (small, no research dependency)
1. `public/` missing: favicon 404 on every page, no OG image, `orgJsonLd` has no logo.
2. Three moment collections carry English slugs on an LT site; `/collections` and `/past-deals`
   too (the doc proposes `/rinkiniai`, `/buvo` with 301s).
3. `S.issueLabel` is a hardcoded „Laiškas Nr. 1 — vėlyva vasara" on the home kicker.
4. `/subscribe` and `/early-alerts` still wear V1 Header/Footer.
5. The deep-research prompt and this architecture doc are **untracked** in git.
6. The Kipras collection filters the whole MEDITERRANEAN zone (PROJECT.md queue item 4).

## 6. Proposed slice order (phase a → b), each = mockup → sign-off → PR
1. **Hygiene slice** (no design): `public/` with favicon + OG image, LT slugs + 301s, commit the
   two research docs, `llms.txt`, real edition number from `issues` (falls back to „Nr. 1").
2. **Deal surfaces slice** (mockups: live · changed · expired · locked · empty edition): verified-ago
   stamp, „išbuvo N val.", price-check strip, window-min line, ground hint, archetype-aware verdict,
   family saving when present. Touches Poster, Rows, deal page, past-deals.
3. **Funnel V2 reflow**: `/subscribe`, `/early-alerts` in V2 dress; `/is-tiktok` landing.
4. **Trust pages**: `/apie`, `/kaip-veikia`, `/duk` (copy deck first, one `lt.ts` addition).
5. **Route pages (phase b, slice 1)**: 24 routes today, gated by the 14-day floor, daily ISR; then
   destination pages; then moment pages as real pages; then the letter archive when letters exist.
   Slugs/titles wait for the research.

Copy for every slice is a separable deliverable: strings in `lt.ts`, one deck for the founder or a
copywriter; „kabliukas" replacement lands in the first copy pass.

## 7. Slug decisions for the existing collections (DataForSEO, Lithuania, lt, pulled 2026-09-12)

Rule: a slug is the Lithuanian query the page can honestly answer, in the form people type it
(no diacritics), matching the URL pattern that already ranks for that query. Volumes are Google
Ads monthly averages; the peak month matters more than the average for seasonal pages.

| Collection (moment) | Slug | Query cluster it targets (avg/mo · peak) | Why this form |
|---|---|---|---|
| Kipras (destinations LCA+PFO) | `/pigus-skrydziai-i-kipra` | „skrydžiai į kiprą" 140 · Oct 210; „pigūs skrydžiai į kiprą" 30 · Sep 170; „vilnius kipras skrydis" 90; „kaunas kipras skrydis" 90; „lėktuvo bilietai į kiprą" 30 | Contains the head phrase `skrydziai-i-kipra` (Wizz `/skrydziai/kipras`, lektuvubilietai `/skrydziai-i-kipra` rank for it) plus the „pigūs" modifier, same pattern as the origin hubs. „kipras" alone (12,100) is weather/maps/people, not flights. |
| Kalėdų mugės (xmas_markets, 20 Nov–23 Dec) | `/kaledines-muges-europoje` | „kalėdinės mugės" 170–210 · Dec 1,300; „kalėdinės mugės europoje 2025" 90 · Nov 480; „kalėdinė mugė" 110 · Dec 880; „kalėdinės kelionės" 260 · Nov 1,000 (package intent) | The term is „kalėdinės mugės", not „kalėdų mugės" (no data) and not „skrydžiai į kalėdines muges" (no data). SERP is blog listicles at `…/graziausios-kaledines-muges-europoje/`; evergreen slug, year goes in the title. Page must exist by mid-Oct (volume starts Oct). |
| Rugsėjo saulė (sept_shoulder, 1–30 Sep) | `/kur-keliauti-rugsejo-menesi` | „kur keliauti rugsėjo mėnesį" < 10 in Ads but present in related searches; the family „kur keliauti {mėnuo} mėnesį" is the proven pattern (estravel, etours rank with exactly that slug) | The moment is September travel, so it cannot honestly wear the October query. The demand sits one month later: „kur keliauti spalio mėnesį" 70 · Sep 210, „kelionės spalį" 50 · Sep 210 — that is the `last_warm_days` moment (1–31 Oct), already in the DB, not yet a collection. **Next collection to add: `/kur-keliauti-spalio-menesi`.** |
| Hub `/rinkiniai`, archive `/buvo` | as in the SEO doc | no search term either way („kelionių kryptys" 30, „kur keliauti" 50 are informational) | Navigation pages, not keyword pages; LT for consistency. |

Not renamed: `/subscribe`, `/early-alerts` (funnel, no search intent, cookie path + ~25 refs).
Tool note: DataForSEO Labs and Google Ads disagree on some month queries („kur keliauti lapkričio
mėnesį" 110 vs 10); the deep research should settle which source to trust for the seasonal pages.
