# V2 „Poster & Bead" site spec — Lithuanian rebuild

**Status:** APPROVED 2026-08-28 — copy deck accepted, §8 calls resolved; building in
worktree `feat-v2-lt` (PR A → B → C).
**Decided already (2026-08-28):** site ships in Lithuanian · hero is **„Randam perliukus."** ·
all journey-audit findings approved (artifact `18ceaad6…`, three-agent audit).
**Sources:** canvas mockups (artifact `6cc22be5…`, artboards extracted: Main / HomeMobile /
DealDetail), `.claude/skills/yip-design-system` V2 rules, audit + LT reports 2026-08-28.

---

## 1. Scope

Rebuild `site/` visually to the V2 "Poster & Bead" direction **and** flip the language to
Lithuanian, as one project (the current code hardcodes English in ~15 components with
English-only date/plural logic — translating the old site first would be double work).

Out of scope: Deal Desk (`web/`), emails beyond the confirm email's strings, fal.ai imagery
(posters use the existing gradient/duotone photo system until images land), accounts/payments.

## 2. Layout — mockups + approved audit changes

Artboards are the base. These approved changes amend them:

**Structural (the big three):**
1. **Form meets the FOMO.** Desktop section order becomes: poster hero → live index
   („Dar spėji") → trophy case („Buvo. Nebėra.") → ink-band capture — the "gone" list flows
   directly into the email form. Mobile gets a closing capture card (page must not end on a
   bare footer). The curator quote moves above the trophy case.
2. **Sticky header, real CTA.** Header is sticky/translucent per the system's own rule; the
   „Noriu radinių" pill is filled amber, not text. Deal page: when "Open in Google Flights"
   opens its tab, the booking column swaps to a capture state („Kol kraunasi — kitas toks
   radinys pirmiausia tavo pašte" + form).
3. **Named curator.** Real name + small photo in the ink band; signature on the quote.
   ⚠ Name/photo needed from founder — see §8. No invented persona.

**Also folded in:**
- Above-the-fold "why subscribe": one clause under the hero — subscribers hear first, a fare
  lives ~2 days.
- Kill the "leftovers" line; replacement in copy deck (§3, ink band).
- Dead trophy rows: no hover invert, muted price, „SUTAUPĖ €90" is the loud element.
- Poster kicker links to breadth: „№ 01 iš 04 šią savaitę" (see §8 on „Nr." vs „№").
- Index kicker reframes count as curation: „Tik 3 verti tavo pinigų šiandien".
- „Skaityk № 1 laišką" sample-issue link under both forms (sample page = one static issue).
- Freshness format unified to ONE style: „tikrinta prieš 2 val." (no mixed today/hh:mm/ago).
- Mobile: mono never below 11px; fluid `--d-*` clamps, not hardcoded px; stamp never
  truncated below „patikrino žmogus · 08:27"; rows get a visible tap affordance; hover
  shifts use `transform`, not padding.
- Top-of-poster scrim (white mono on amber fails contrast); coral reserved for urgency
  (drop-story chips use sea-teal); fixed meta grammar: route · dates · saving (+ story 4th).
- Every timestamp/stat rendered from real records — a hardcoded "tikrinta prieš 2 val." is
  fake urgency and is banned. August stats verified before ship or omitted.
- GDPR: privacy link at every capture point.
- Keep (do not redesign away): masthead kicker, catch-line under poster, strikethrough gone
  typography, honest fine print, "we never touch your money" column, no invented social proof.

## 3. Lithuanian copy deck — FOR FOUNDER REVIEW

Voice: **tu**, lowercase; spoken short verbs (*randam, tikrinam, siunčiam*) in headlines,
CTAs, chips; full forms allowed in body rhythm. Product noun: **radinys**. Banned: akcija /
pasiūlymas galioja / nepraleisk progos! / superkaina / WOW; anglo-slang (dylas, topinis);
exclamation stacking; diminutive overload (one perliukas is charm, three is baby talk).

| # | Where | EN (mock) | LT (ships) |
|---|-------|-----------|------------|
| 1 | Hero H1 | We find the gems. | **Randam perliukus.** |
| 2 | Hero subhead | Hand-checked cheap flights from the Baltics — 3-5 a week… You book direct. | Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos, atrinkti žmogaus — 3–5 per savaitę. Prie kiekvieno: kodėl verta ir koks kabliukas. Bilietą perki tiesiogiai. |
| 3 | Human stamp | checked by a human · today 08:27 | patikrino žmogus · šiandien 08:27 |
| 4 | Badge | Rare fare | Retas radinys *(alt: Gintaras — §8)* |
| 5 | Collection kicker | Last warm days | Paskutinė šiluma *(chip-tight: Dar šilta)* |
| 6 | Poster CTA | See the deal | Žiūrėti skrydį *(hero-only playful, max once: Skrendam?)* |
| 7 | Trophy header | Recent finds. All gone now. | **Buvo. Nebėra.** *(fuller: Švieži radiniai. Jau dingę.)* |
| 8 | Trophy caption | Subscribers heard first | Kas gavo laišką — spėjo. |
| 9 | Trophy footnote | A rare fare lasts about two days. The email is the early door. | Retas radinys gyvena porą dienų. Laišką gauni anksčiau, nei jis dingsta. |
| 10 | Live index header | Still bookable today | Dar spėji |
| 11 | Ink band H2 | The next gem is gone in about two days. | Kitas perliukas dings per porą dienų. |
| 12 | Ink band body (replaces "leftovers") | Subscribers get each find the morning we make it… | Prenumeratoriai gauna kiekvieną radinį tą rytą, kai jį patvirtinam. Kol jis čia — pigiausių vietų dažnai nebelieka. |
| 13 | Header pill | Get deals by email | Noriu radinių *(band full form: Gauk radinius el. paštu)* |
| 14 | Submit button | Get deals | Noriu radinių *(neutral: Gauti radinius)* |
| 15 | Fine print | 3-5 fares a week · no spam · unsubscribe anytime | 3–5 radiniai per savaitę · be spamo · atsisakai kada nori |
| 16 | Catch-line | Hand luggage only · fixed dates 12-19 Sep · Wizz Air · checked 2h ago | Tik rankinis · tikslios datos: rugs. 12–19 · Wizz Air · tikrinta prieš 2 val. |
| 17 | Index kicker | 03 deals — updated this morning | Tik 3 verti tavo pinigų šiandien · atnaujinta šįryt |
| 18 | This week section | This week's finds | Šios savaitės radiniai |
| 19 | Urgency chip | Going fast | Tirpsta |
| 20 | Issue label | Issue № 1 — Late summer | Nr. 1 — vėlyva vasara |
| 21 | Nav | How it works / All deals / From Vilnius… | Kaip tai veikia / Visi radiniai / Iš Vilniaus / Iš Kauno / Iš Rygos |
| 22 | Footer | Made in Vilnius | Sukurta Vilniuje |
| 23 | Curator sig | The curator — Vilnius | **[VARDAS] — Yip kuratorius, Vilnius** *(placeholder — §8)* |
| 24 | Success state | Almost there — confirm your email. | Liko vienas žingsnis — patvirtink el. paštą. |
| 25 | Success sub | We've emailed you a confirm link… | Išsiuntėm patvirtinimo nuorodą. Paspausk ją — ir kitas radinys tavo. |
| 26 | Early-alerts checkbox | Also join early alerts — free | Noriu ir skubių žinučių — nemokamai *(sub: Rečiausi radiniai iškart, kai tik juos randam — dar prieš savaitinį laišką.)* |

Longer surfaces (deal page why/catch generator, FAQ, confirm email, /early-alerts,
/subscribe states) get their LT pass in the build using this deck's voice; founder reviews
them in the PR preview, not string-by-string here.

## 4. Language mechanics (build rules)

- **Dates:** month-genitive order, VLKK abbreviations lowercase: chip „rugs. 12–19";
  cross-month „rugs. 29 – spal. 2"; relative „prieš 2 val." / „prieš 4 min."; 24h time.
- **Prices:** symbol after with space — „102 €", „nuo 59 €"; thousands „12 400"; „27 °C".
- **Plurals:** CLDR `lt` rules (1 radinys / 2–9 radiniai / 0,10–20 radinių) via one helper;
  no string-concat plurals anywhere.
- **Cities:** poster/index/chips = nominative (MALTA); any sentence declines (į Maltą,
  Maltoje, iš Vilniaus). LT display layer with three cases per destination
  (`lt_nom/lt_acc/lt_loc`) + LT exonyms (Larnaka, Viena, Atėnai, Stambulas…) — a separate
  map, NOT an edit to the Python-shared canonical `airports.json`.
- **Quotes:** „…" (fix the mock's straight close-quote).
- **Diacritics gate (blocking):** ą č ę ė į š ų ū ž upper+lower render in every used weight
  of Bricolage Grotesque display sizes, Hanken Grotesk body, Space Mono — plus caron/ogonek
  clipping test at `--d-hero` line-height. The `yıp` wordmark's dotless-ı never goes through
  LT text-transform; render the wordmark as image/aria-labelled span, not copyable text.
- **Width budget:** +25% on every EN string; every chip/badge/header string has a designated
  short form (deck above). Poster field auto-shrinks — stress-test FUERTEVENTŪRA, STOKHOLMAS.

## 5. SEO

- `<html lang="lt">` (site + emails). Title: „Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos —
  atrinkti žmogaus | Yip".
- Poster H1 stays voice-pure; the hero subhead carries the head phrase naturally.
- Origin pages own the terms (live volumes): „skrydžiai iš Vilniaus" 1 600/mo ·
  „skrydžiai iš Kauno" 1 600/mo · „pigūs skrydžiai iš Kauno" 590/mo (KD 2, unclaimed).
  New slugs `/is-vilniaus` `/is-kauno` `/is-rygos` with H1 „Pigūs skrydžiai iš Kauno —
  atrinkti žmogaus".
- Existing English slugs (`/cheap-flights-from-vilnius`…) 301 → LT slugs; hreflang set;
  sitemap + JSON-LD regenerated in LT.

## 6. Build prerequisites (phase 1 of the build)

1. **String catalog** — extract every hardcoded string to one `lt.ts` catalog (single
   language, no i18n framework — YAGNI until a second language exists).
2. `format.ts` LT: months, `timeAgo` → „prieš X", `freshnessLabel` LT, plural helper.
3. LT city/country display map (3 cases + exonyms) with a drift-guard test against
   `airports.json` IATA keys.
4. Sample-issue static page (content: the real first email, or founder-written).

## 7. Delivery plan

Fresh worktree `feat-v2-lt` off main. Three PRs, each shippable dark:
- **PR A — LT infrastructure:** string catalog, format/plural/city helpers, lang=lt,
  slugs+redirects. Site looks the same but speaks LT. (The V1 design in LT is acceptable
  for the day or two before PR B lands.)
- **PR B — V2 layout:** poster components, section order, sticky header, capture states,
  trophy case, ink band, mobile artboard. Design flips.
- **PR C — polish:** deal-page post-click capture, sample issue, SEO/JSON-LD pass,
  diacritics/contrast audit, Lighthouse + mobile QA.
Preview URLs at every PR (Vercel previews now work). Nothing merges without founder's look.

## 8. Founder calls — RESOLVED 2026-08-28 morning

1. **Curator: configurable, never hardcoded.** "We might have different people" — curator
   name (and later photo) comes from config (env var / site config module), rendered
   wherever the curator is named. Ships with a neutral fallback („Yip kuratorius,
   Vilnius") until a name is set. No invented persona ever.
2. **Badge: „Retas radinys"** (Gintaras rejected).
3. **„Skrendam?": YES** as the hero-card CTA, max once per page; all other deal buttons
   „Žiūrėti skrydį".
4. **Issue numbering: restarts at „Nr. 1"** with the V2 launch (default accepted).
5. **Trophy header: „Buvo. Nebėra."**
6. **Copy deck 1–26: approved as written** (no vetoes raised).
