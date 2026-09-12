# yip.lt — sitemap, interlinking and SEO/conversion architecture (draft for the site redo)

Status: proposal (2026-09-11). Grounded in what exists: 159 scanned routes from VNO/KUN/RIX (+10 reverse
routes from WP7), 180-day price history per route in `price_log`, 15+3 templates → moments, the LT keyword
sample (`docs/research/2026-08-29-lt-keyword-volumes.md`), the funnel (free letter → paid), and the spec's
"deferred to the site redo" list. Copy/design stay the founder's; this is structure.

**Keyword caveat (founder, 2026-09-11):** the August volumes are a high-level first sample, not a rule.
The travel niche has hundreds of long-tail queries the sample never touched; the page types below are
chosen for intent and for the data we uniquely hold, and the exact slugs/titles get re-decided from the
full keyword universe the deep research returns (item 1 of the prompt). Nothing here is keyword-anchored.

## 1. The concept in one line
Yip's unfair asset is **its own price history + a human verdict** for every Baltic route. Every page
should show that asset (live find, "įprastai €X", how long deals last, human-checked stamp) and
funnel to one action: the email. Programmatic pages carry the SEO weight; the letter carries the money.

## 2. Sitemap (LT slugs, ASCII, no diacritics)

### A. Core (exists, keep URLs)
| Page | URL | Intent / role |
|---|---|---|
| Home | `/` | Current edition (1 open + 2 teasers + locked rest), signup |
| Deal | `/deal/[id]` | The find; leaf that links UP to route, destination, moment, origin |
| Past deals | `/past-deals` (→ rename `/buvo`, 301) | Proof archive „Buvo. Nebėra." (noindex per deal, index the list) |
| Collections index | `/collections` (→ `/rinkiniai`) | Hub of hubs |
| Origin hubs | `/pigus-skrydziai-is-vilniaus`, `-kauno`, `-rygos` | Head terms (2,400 / 480 mo) |
| Funnel | `/subscribe` (→ `/prenumerata`), `/early-alerts` (→ `/pirmieji`), `/confirm`, `/atsisakyti`, `/privatumas` | Conversion + legal; `/go/*`, `/uzsisakiau/*` noindex |

### B. Programmatic layer (new — the moat)
| Page type | URL pattern | Count | Unique content (from our data) |
|---|---|---|---|
| **Route page** | `/skrydziai/vilnius-londonas` (origin-city–destination-city) | ~169 | live finds on the route, 180-day price chart, „įprastai €X, žemiausia per 90 d. €Y", cheapest months, airlines seen, direct vs stops, ground hint (KUN train), last 3 expired finds with „išbuvo N val.", FAQ |
| **Destination page** | `/kryptys/londonas` | ~96 | all origins to the city, best origin now, seasonality, links to each route page + moment pages it belongs to |
| **Reverse/diaspora route** | `/namo/is-londono` (+ hub `/namo`) | 7 origins | WP7 routes; „Grįžtu namo" windows (Kalėdos, Velykos, vasara), school-holiday calendar tie-in |
| **Airport pages** | `/oro-uostai/kaunas`, `/vilnius`, `/ryga` | 3 | how to get there, which airlines, what we scan from here — supports origin hubs |

Rule: a route/destination page exists only when it has ≥ 14 scan-days of history (spec's
`FLOOR_MIN_DAYS`) — thin programmatic pages are a Helpful-Content-update liability. Pages regenerate
daily (ISR) and show „atnaujinta {date}".

### C. Moment collections (exist as config; become real pages)
| Slug | Term it targets | Timing |
|---|---|---|
| `/savaitgalio-keliones` | savaitgalio kelionės 2,900/mo (stable) | always |
| `/kur-keliauti-lapkriti` | kur keliauti lapkritį (peaks Sep–Oct) | publish now |
| `/kaledu-muges` | kalėdinės mugės europoje (tiny but exact) | Oct |
| `/slidinejimas` | slidinėjimo kelionės 210 / kurortai 140 (Jan peak) | Nov |
| `/atostogos-su-vaikais` | kelionės/atostogos/poilsis su vaikais (90–260) | before each school break |
| `/mokiniu-atostogos-2026-2027` | žiemos atostogos 1,300 (Jan) + „mokinių atostogos" | evergreen; **.ics download = lead magnet** |
| `/ziemos-saule`, `/velykos`, `/vasara` | seasonal windows we already scan | 6–8 weeks before |
| `/paskutines-minutes-skrydziai` | paskutinės minutės kelionės 4,400 (package intent — page must say „skrydžiai, ne paketai") | always |

### D. Trust & content (thin but high-conversion)
`/apie` (who checks the finds — the curator is the brand), `/kaip-veikia` („Kaip mes dirbam" — the
show-the-catch rule, verification, why locked), `/laiskai/[n]` (**newsletter archive**: every sent issue
becomes a page with prices marked as past — sample letter + SEO content + trust), `/kainu-indeksas`
(quarterly Baltic flight-price index from `price_log` — PR/link bait), `/kaina` (paid plan page once
the Payment Link exists), `/duk` (FAQ with FAQPage schema).

### E. Later
`/lv/*` Latvian layer (RIX audience), an EN landing for diaspora (`/home`), route-alert prefs.

## 3. Interlinking model (hub-and-spoke, three hubs)
- **Origin hub** → its destination pages (grouped by moment) → **route pages** → **deal pages**.
- **Destination page** → route pages (one per origin) + the moment collections it belongs to.
- **Moment collection** → live deals + the route pages of its destinations (even with no live deal).
- **Deal page** links up to: route page, destination page, origin hub, its moment(s) — and sideways to
  "kiti radiniai iš Vilniaus" (3). Expired deal keeps 200 + noindex + link to the route page (so old
  TikTok links still convert).
- Breadcrumbs everywhere (`BreadcrumbList` schema): Yip › Iš Vilniaus › Londonas › radinys.
- Footer: top 10 routes by search demand + the 3 origin hubs + 4 live moments (rotates by season).
- Sitemaps split: `sitemap-core.xml`, `sitemap-routes.xml`, `sitemap-destinations.xml`,
  `sitemap-deals.xml` (live, free-window only), `sitemap-letters.xml`.
- Schema: `Organization`, `BreadcrumbList`, `ItemList` on collections, `Offer` (price, priceCurrency,
  validThrough, url) on deals, `FAQPage` on route/destination/DUK pages, `Article` on letters.
- Canonicals: route page is canonical for the route; collections never duplicate route content, they list.

## 4. Conversion architecture
- One primary action site-wide: the free letter. Paid is offered after confirm and in letters, never cold.
- Route/destination pages: CTA „Gauk, kai Vilnius–Londonas nukris žemiau €X" — captured as a
  **route-interest pref** (`prefs.routes`), not a new scan; feeds WP8 and the paid upsell.
- Proof blocks reuse real data only: price-history chart, „išbuvo 36 val.", „{n} prenumeratorių
  užsisakė" (from `deal_events`), „Patikrino žmogus".
- Edition scarcity (1+2 open, rest locked) stays; locked rows are the conversion point.
- TikTok landing: `/is-tiktok` (deal from the video + signup) with `utm_content = video id`; the
  attribution already lands in `prefs.utm` and shows on `/letters/stats`.
- School-holiday `.ics` as the lead magnet (double opt-in delivers the file).

## 5. Angles the founder may not have on the list
1. **GEO / AI answers**: consistent entity naming, FAQ blocks with the exact question phrasing, an
   `llms.txt`, and route pages that answer „kada pigiausia skristi į Londoną iš Vilniaus" in one sentence.
2. **Google Discover**: weekly „Savaitės radinys" letter pages with a large image can surface in Discover
   for LT users — cheap traffic if the archive is an `Article`.
3. **Seasonal publishing calendar**: pages must exist 6–8 weeks before the query peaks (Oct for
   Christmas markets, Nov for ski, Jan for žiemos atostogos, Sep for „kur keliauti lapkritį").
4. **Diaspora search happens in two languages**: „pigūs skrydžiai į Lietuvą iš Londono" (LT) and
   "cheap flights London to Kaunas" (EN, huge competition) — LT-first, EN landing later.
5. **Brand SERP**: „yip skrydžiai", „yip.lt atsiliepimai" — own them with `/apie` + `/duk`.
6. **Programmatic quality gate**: every route page needs unique numbers + a rules-written verdict
   (the WP3 body rules generalise); otherwise noindex it.
7. **Legal/commercial**: GDPR marketing consent wording, LT consumer law for recurring subscriptions
   (14-day withdrawal, cancellation), VAT on a digital subscription — before the Payment Link goes live.

## 6. Deep-research prompt (for the founder to run)
See the chat message of 2026-09-11 or `docs/research/2026-09-11-deep-research-prompt.md`.
