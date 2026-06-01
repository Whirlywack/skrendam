# Skrendam — Deal Engine + Curator (v1): Design Review Brief

> **Purpose of this document.** This is a design under review, not a finished spec. Please act as a skeptical senior engineer + product reviewer. I want to know **what's missing or wrong for a realistic v1**, and where I've made a weak assumption. For every issue you raise, give me **2–3 concrete options with trade-offs and your recommendation** — not a single "correct" answer. Prioritise risks that could sink the project (legal, data-source viability, deal supply, blocking) over polish. The specific questions I most want answered are collected at the end under **"Questions for the reviewer."**

---

## 1. What the product is

A **flight-deal membership business** for the **Lithuanian market** (think Going / Jack's Flight Club / Scott's Cheap Flights, localized). Business model:

- **Free tier** (later): newsletter + public site + SEO destination pages → builds audience.
- **Premium annual membership** (later): earlier access, more deals, airport personalization, premium-cabin deals.
- **Affiliate / booking revenue** underneath; ancillary partners (insurance, lounges, eSIM) much later.

The core promise users pay for is **curation and speed** — "we surface genuinely good fares before you'd find them yourself" — not raw flight search.

**Acquisition & positioning (added after review).** Primary top-of-funnel is **organic TikTok**. The funnel is **TikTok attention → owned audience (email + Telegram) → paid membership**. Brand positioning is **"curated Lithuania / Baltic flight deals"** — *not* mistake-fare-led. Mistake fares become a later *premium feature*, not the v1 hook. **Converting attention into an owned, paying audience is now a top, day-one risk (R0), tested in parallel with deal supply — not after it.**

### Build order (each stage de-risks the next)
1. **Spec 1 — Deal Engine + Curator** ← *this document*. Private tool; the founder is the only user.
2. Spec 2 — Public free product (Next.js site, SEO pages, newsletter signup + sending, accounts).
3. Spec 3 — Monetization (Stripe annual tiers, premium gating, affiliate link management).
4. Spec 4+ — Elite tier (premium cabins/points), push alerts, ancillary partners, B2B feed.

**Spec 1 goal:** prove we can *reliably produce a daily/weekly stream of genuinely good, curated deals from Lithuanian airports without getting blocked* — before building any consumer-facing product or billing.

---

## 2. The foundation we're building on

Forked repo: **Skrendam** (a fork of the open-source **`fli`** project) — "Google Flights MCP, CLI and Python library." MIT-licensed. Python (primary, best-maintained) + a complete TypeScript port (`fli-js`).

**What it gives us (verified by reading the source):**
- Talks to Google Flights' **internal/reverse-engineered API** (not HTML scraping). Returns structured, typed results.
- `SearchFlights.search()` → full itineraries: price, legs, stops, duration, layovers (incl. overnight / airport-change), operating airline, aircraft, legroom, amenities, emissions, self-transfer/mixed-cabin flags.
- `SearchDates.search()` → a **price-per-date calendar** for a route across a range. Max **61 days per request** (auto-chunks longer ranges), max **~305 days** into the future. Returns `(date, price)` pairs — *no itinerary detail*.
- `get_booking_options()` → vendor fares + booking URLs for a chosen itinerary. **Caveat:** frequently returns empty server-side (Google needs a browser-minted session token the library doesn't reproduce); a per-flight Google Flights deep link is always available as fallback.
- Filters: cabin, airlines (incl/excl), alliances (incl/excl), max stops, layover min/max, bags, emissions, exclude-basic-economy, sort.
- Locale: `currency` (EUR), `language` (`hl`), `country` (`gl`) params supported.
- Airport database (~thousands of airports). VNO/KUN/PLQ all present.
- An MCP server (for AI assistants) — **not used by the scanner**; the scanner imports the library directly.

**What it does NOT give us (these shape the design):**
- ❌ No "anywhere / explore from X" search. **The engine is strictly route-based** → we must feed it an explicit destination list and iterate.
- ❌ No native **price-level benchmark** for fares ("prices are low/typical/high"). That signal exists in Google Flights' UI but the library only decodes it for **CO₂ emissions**, not price. So we cannot borrow Google's "is this cheap?" judgement — we must compute our own baseline.
- ❌ It is **rate-limited / will return HTTP 429** under load (the repo's own tests hit the live API and get throttled). No official quota; behaviour can change without notice.

---

## 2A. Live validation — we ran it on real data (2026-06-01)

Before locking the design we installed `fli` (Python 3.13) and hit live Google Flights on real Lithuanian routes, to replace assumptions with a real picture.

**Results — real one-way cheapest fares, EUR (date window Jul–Aug 2026):**

| Route | Real cheapest | Note |
|---|---|---|
| VNO → London Stansted (STN) | **€17** | Ryanair — strong supply |
| VNO → Barcelona (BCN) | **€30** | Wizz Air nonstop, confirmed by both tiers |
| KUN → Málaga (AGP) | **€57** | Kaunas Ryanair |
| RIX → Tenerife (TFS) | **€224** | long/island route = structurally pricier |

**Behaviour observed:**
- ✅ Works on LT routes in EUR; tier-1 (`SearchDates` calendar) and tier-2 (`SearchFlights` detail) **agree** on price.
- ⏱ **Cold call ~6.8s** (process start + `curl_cffi` import + first connection); **warm calls ~1s**.
- ✅ **No HTTP 429s and no timeouts** across a small multi-route burst.
- ✅ The CLI `--format json` / library result shape maps cleanly onto our `price_log` + `candidates` schema; every flight carries a `booking_url` `tfs` deep link.

**Six integration/deployment corrections adopted (architecture unchanged):**
1. **Integrate via the Python library, not the CLI's JSON.** `--format json` is flagged **experimental ("schema may change")**; the scanner imports `SearchDates`/`SearchFlights` directly (stable API).
2. **Pin Python ≤ 3.13 on the scanner host.** Python 3.14 breaks the `pydantic-core` build.
3. **Run the scanner as a warm, long-lived worker** — never a fresh process per route. Cold start ~6.8s vs warm ~1s; this is the difference between a multi-minute and an hour-long scan. (Reinforces the off-Vercel always-on-worker decision with hard evidence.)
4. **Add our own pacing + backoff on top of the built-in** (10 req/sec ceiling + only 3 retries + 60s timeout = built for one-off lookups). For sustained scanning: lower `FLI_TIMEOUT` to ~20–30s, pace ~1 call / 1–2s with jitter (far under 10/sec), add our own exponential backoff + circuit-breaker, and log every 429 to `scan_runs`.
5. **Calibrate `zones` thresholds from a one-time real calibration scan — not guesses.** Reality differs sharply from placeholder numbers (RIX→TFS €224 vs an earlier €79 mock).
6. **`get_booking_options` is unreliable** (empty vendor fares without a browser-minted token — confirmed in docs). Rely on the per-flight `booking_url` deep link; note it carries **no affiliate attribution** → reinforces R1 (affiliate revenue likely needs a real affiliate API).

---

## 3. Spec 1 scope & non-goals

**In scope:** scanner worker, two-tier scanning, scoring/triage, Postgres schema, a private auth-gated curator admin (Next.js) to review/approve/edit/reject candidates, and persistence of published deals.

**Explicitly NOT in scope for v1:** public website, SEO pages, newsletter signup/sending, user accounts, Stripe/billing, premium gating, push alerts, mobile app. (The schema leaves hooks for these but builds none of them.)

**Under review (R0):** a *thin distribution surface* — auto-post published deals to a **Telegram** channel + a one-page **email-capture** endpoint — may be pulled into Spec 1 so **audience conversion can be tested alongside deal supply**. Decision pending (see R0).

---

## 4. Architecture

```
        ✈ Google Flights  (external, rate-limited)
                 ▲  paced calls · jitter · exponential backoff on 429
                 │
        ┌────────┴─────────┐
        │  Python Scanner   │  always-on host (Railway / Fly / small VPS), NOT Vercel
        │  (reuses `fli`)   │  — runs on a schedule
        └────────┬─────────┘
                 │ tier-1: SearchDates calendar  → price_log
                 │ tier-2: SearchFlights (only on anomalies) → candidates
                 ▼
        ┌──────────────────┐
        │     Postgres      │  routes · zones · scan_runs · price_log · candidates · published_deals
        └────────┬─────────┘
                 │ reads candidate queue
                 ▼
        ┌──────────────────┐
        │  Curator Admin    │  Next.js on Vercel, auth-gated, single user
        │  approve/edit/    │  → writes published_deals
        │  reject           │
        └──────────────────┘
                 │
                 ▼  (Spec 2 reads published_deals: newsletter + public site)
```

**Key decision:** the **web app is Next.js on Vercel**; the **scanner is a Python worker on its own cheap always-on host**, because paced scraping does not fit serverless (parallel cold-starts would hammer Google → instant 429/IP-block). The two sides are loosely coupled — they only share Postgres.

---

## 5. Two-tier scanning (rate-limit-friendly)

1. **Tier 1 — broad & cheap.** For each enabled route, call `SearchDates` to get the price-per-date calendar across the scan window (one call covers ~2 months). Store every `(route, date, price)` in `price_log`. From this curve compute a **window-relative baseline** (min / median / cheapest-decile). Flag dates whose price is anomalously low.
2. **Tier 2 — deep, only on anomalies.** For flagged dates only, call `SearchFlights` to fetch the full itinerary (stops, duration, layovers, airlines, bookability). Run the full gate/score model. Store winners as `candidates` with a rich snapshot.

This keeps the expensive, detail-heavy calls limited to fares that already look promising — minimizing total API calls (and 429 risk) while still getting rich data where it matters.

---

## 6. Data model (Postgres)

**Config (edited in admin):**
- **`routes`** — `id` (pk), `origin` (VNO/KUN/PLQ), `destination` (IATA), `zone` (fk), `enabled`, `scan_window_days` (~120), `cabin` (ECONOMY), optional `round_trip`/`trip_len`.
- **`zones`** — `zone` (pk, e.g. MED/WESTERN_EUROPE/CANARIES/LONG_HAUL), `haul_type` (short/med/long), `threshold_price_eur` (heuristic "interesting" ceiling), `min_abs_savings_eur`, `min_discount_pct`. *This is where the "Europe under €40 / long-haul under €350" logic lives, editable without code.*

**Pipeline:**
- **`scan_runs`** — `id`, `started_at`/`finished_at`, `scanner_version`, `routes_scanned`, `api_calls`, `http_429s`, `candidates_found`, `errors`, `status`. *(Ops metrics → tune pacing & thresholds.)*
- **`price_log`** — `id`, `run_id`/`route_id` (fk), `travel_date`, `price`/`currency`, `scanner_version`, `scanned_at`. *(Lean tier-1 points → baselines & history.)*
- **`candidates`** — `id`, `run_id`/`route_id`, `deal_group_key` (dedup: route + date-band + headline-price-band), `travel_date`/`return_date`, `price`/`baseline_price`/`discount_pct`, `deal_score`, `gate_results` (jsonb), `reason_text` ("why it triggered"), `itinerary_snapshot` (jsonb, tier-2), `search_params` (jsonb, for re-scoring), `status` enum `new→seen→approved→edited→rejected→expired`, `first_seen_at`/`last_seen_at`, `expires_at`.
- **`published_deals`** — `id`, `candidate_id` (fk), `headline` (curator-written), `body` (optional), `origin`/`destination`/`zone`, `price`/`baseline`/`discount_pct`, `travel_window_start`/`_end`, `booking_url`, `valid_until`, `last_seen_at` (auto-hide dead deals), `tier` (free/premium hook), `status` (live/expired), `published_at`.

---

## 7. Scoring / triage model

**Philosophy:** the scanner is a **candidate generator for a human**, not a deal oracle. It should say "cheap enough vs expectation AND clean enough operationally that a human should look," then explain *why*.

**Four gates (a candidate must clear them):**
1. **Price-anomaly** — fare is meaningfully below baseline. Baseline cascade (no history needed at launch): (a) window-relative (vs the route's own date-curve), (b) heuristic zone threshold, (c) cross-sectional (vs other itineraries same search). Our own logged history strengthens this in phase 2.
2. **Itinerary-sanity** — exclude junk: too many stops, airport changes, impossible self-connects, brutal overnight layovers, awful arrival times.
3. **Marketability** — enough *absolute* savings (€ users feel) and/or % savings and/or hits a psychological threshold ("Europe under €50").
4. **Freshness / urgency** — prefer near-term, short-window, or unusually-low premium-cabin fares likely to vanish.

**Deal Score (weighted, for ranking the curator's queue):**
`0.45·price_anomaly + 0.25·itinerary_quality + 0.15·bookability/trust + 0.15·novelty/urgency`
*(This formula is a starting hypothesis, not gospel — tunable via `scan_runs` feedback.)*

Send to curator only if: `deal_score > threshold` **and** price-anomaly is strong on its own **and** itinerary-quality clears a floor.

---

## 8. Decisions made so far (with the alternatives we rejected)

| Decision | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Deal sourcing | **Hybrid: software surfaces, human approves** | Fully manual; fully automated | Quality + trust with some leverage; matches how the incumbents started |
| Origin airports | **VNO, KUN, PLQ + RIX (Riga) from day one** | WAW too; VNO/KUN/PLQ only | RIX is a major airBaltic hub Lithuanians genuinely use → bigger deal supply. **PLQ = bonus supply, not core.** WAW is an easy next add. |
| Brand positioning | **Curated Lithuania/Baltic deals** | Mistake-fare-led | Sustainable supply; mistake fares become a premium feature later (R3 downgraded) |
| Detection | **Thresholds + window-relative now, log history for later** | History-only; cheapest-now | Launch day-one without weeks of data |
| Stack | **Python scanner + Next.js/Vercel + shared Postgres** | All-TypeScript (`fli-js`); all-Vercel | Scraper runs on the most-maintained engine; loose coupling |
| Scanner host | **Always-on, warm, long-lived worker off Vercel** (Python ≤3.13) | Vercel Cron + functions | Paced scraping ≠ serverless; verified live: cold ~6.8s vs warm ~1s (see §2A) |
| Engine integration | **Import the `fli` Python library directly** | Shell out to CLI `--format json` | CLI JSON is experimental; library API is stable (see §2A) |
| Scan shape | **Two-tier (calendar → deep on anomalies)** | Deep search every route/date | Far fewer calls → less 429 risk |

---

## 9. Open questions & risks (this is the important part)

Each is something I'm **not confident about for v1**. Please weigh in with options + a recommendation.

**Revised priority order (after first review pass):** **R2 (deal supply) → R0 (audience conversion) → R1 + R5 (legal/data source + affiliate) → R3 (freshness — downgraded) → R4 (baseline) → R6 (curator) → R7 (ops).** Codes keep their original numbers; only the ranking changed. Entries below are presented in the new priority order.

### R2 — Deal supply: will the airports produce *enough* good deals? ⚠️ #1
A premium promise is "**more** deals." VNO is mid-sized, KUN is Ryanair-heavy (good for cheap fares!), **PLQ is tiny/seasonal**. Too few good deals/week and no subscription is justified — **if supply fails, nothing else matters.**
- **Decision taken:** **add Riga (RIX) from day one**; treat **PLQ as bonus supply, not core**. Design `routes` so adding origins is trivial; keep **WAW (Warsaw)** as an easy next addition.
- **Open:** Will Lithuanian deal-seekers accept **RIX/WAW** departures (RIX ~3–4h from Vilnius, common in practice)? Realistic good-deals-per-week from VNO + KUN + RIX? Is KUN's Ryanair density enough to carry early supply?

### R0 — Acquisition / list conversion (NEW · co-#1) ⚠️
The biggest risk is no longer just "can we find deals?" but **"can TikTok attention become an *owned* audience, and can that audience become *paying* members?"** Views ≠ subscribers ≠ payers — and this must be tested **alongside** deal supply, not after.
- **Options:** (a) validate with **zero build, now** — a hand-run **Telegram** channel + a no-code email-capture page (Tally/Carrd); founder posts a few deals found via the `fli` CLI; drive a little **TikTok** traffic; (b) build a thin **distribution adapter** into Spec 1 — auto-post published deals to Telegram + a one-page email-capture endpoint; (c) wait for Spec 2's full newsletter/site.
- **My take:** (a) **immediately, in parallel with building the engine**, then (b) as the final slice of Spec 1. Don't spend weeks proving supply only to discover nobody converts. *(This has a Spec 1 scope implication — flagged for decision.)*
- **Questions:** Which conversion benchmarks matter most (view→sub, sub→reply, sub→paid)? **Telegram vs email** as the primary owned channel in Lithuania? Which TikTok content format actually converts deal-watchers into subscribers?

### R1 — Legal / data source + affiliate monetization (R5 folded in) ⚠️
The engine relies on Google Flights' **reverse-engineered internal API**. **`fli` is fine for *private* proof-of-supply (Spec 1). It is *not* a safe permanent foundation for a *paid* business** — it likely violates Google's ToS, can break without warning, and scaling the scan invites blocking. Separately, **affiliate revenue** (folded in from old R5) depends on the data source: `get_booking_options()` often returns empty and the deep links are plain Google Flights URLs with **no affiliate attribution** — so booking revenue may require the data source to *be* an affiliate network.
- **Options:** (a) `fli` now, accept the risk for the private phase only; (b) migrate the production data source to a **licensed / affiliate-enabled API** — Amadeus Self-Service, Duffel, Kiwi/Tequila, **Travelpayouts/Aviasales** (pays commission), Skyscanner partner — and keep `fli` as fallback/cross-check; (c) hybrid: `fli` for cheap broad scanning, licensed API to *confirm + monetize* a candidate before publishing.
- **My take:** `fli` for Spec 1, but **start testing the affiliate/licensed path early** (during Spec 1, not Spec 3) because it affects both legality *and* revenue. Travelpayouts looks like the most promising single answer to both.
- **Questions:** Which flight data/affiliate API explicitly permits a deal-alert product in the EU **and** pays commission? Cheapest viable production source? How do real deal clubs (Going, Jack's) actually source + monetize legally?

### R3 — Mistake-fare freshness (downgraded → later premium feature)
**Downgraded from a core v1 risk.** Build the brand around **"good curated Lithuania / Baltic flight deals,"** not mistake fares. Mistake fares (which vanish in hours and demand aggressive, block-prone scanning) become a **premium feature later**, not the v1 hook.
- **Options (for later):** (a) once-daily full scan; (b) daily scan + fast re-scan of a small "hot" subset; (c) event-driven escalation on sharp drops.
- **My take:** once-daily is fine for v1 supply; revisit cadence only when mistake fares become a paid feature.

### R4 — Robustness of a history-free baseline
Window-relative baseline can be fooled when a *whole route* is structurally expensive/cheap, or seasonally skewed (everything in August is dear). Risk: false "deals" or missed ones early on.
- **Options:** (a) window-relative + curated zone thresholds (current plan); (b) add cross-sectional same-day comparison; (c) seed thresholds from a one-time historical pull / public fare data; (d) **NEW — use a real external "typical price" benchmark.** Google Flights actually exposes `price_level` (low/typical/high) + `typical_price_range` + `price_history`; `fli` doesn't decode it, but **SerpApi's Google Flights API returns it as structured `price_insights`** (paid per search). That's a genuine cold-start baseline without weeks of our own data.
- **My take:** (a)+(b) for the *free* `fli` scan at launch; strongly consider (d) — even calling SerpApi `price_insights` only on tier-2 candidates (a handful per day) would give an authoritative "is this actually below typical?" check cheaply, and doubles as a cross-validation of `fli`'s numbers. Revisit (c)/own-history once `price_log` matures.

> **Scoring weights — researched (Going / Hopper / Google Flights):** price-vs-typical is the dominant signal across all of them; itinerary quality is treated as a *separate axis*, not blended heavily. Refined weights: **price-anomaly 0.50, itinerary-quality 0.20, bookability 0.15, urgency 0.15.** Crucially, **the curator's approve/reject log is labelled training data** — hardcode these seeds, then fit the weights (or a small model) empirically after a few weeks. This is the same data-driven approach Hopper/Going use.

### R5 — *(merged into R1)*
Affiliate monetization is now folded into **R1**, because the choice of data source determines both legality *and* affiliate revenue. Kept as a numbered placeholder so prior references don't break.

### R6 — Curator workflow & notification
The curator (me) needs to know when to look. Not yet designed.
- **Options:** (a) just open the admin daily; (b) a daily digest email/Slack/Telegram of new top candidates; (c) threshold-triggered ping for standout deals.
- **My take:** (b) daily Telegram/email digest — cheap, fits a solo operator. In scope for v1?

### R7 — Operational details to confirm
- **Postgres provider:** Neon (Vercel Marketplace) vs Supabase vs plain managed PG. *(Lean Neon for Vercel integration.)*
- **Scanner ORM/migrations:** SQLAlchemy + Alembic vs raw SQL. Both Python scanner and Next.js app touch the same DB — who owns migrations?
- **Admin auth:** single-user — Clerk (overkill?) vs a simple password / magic link.
- **`price_log` growth & retention:** ~3 origins × ~80 dests × ~120 dates ≈ 29k rows/full-scan. Daily ≈ ~10M rows/yr. Retention/rollup policy?
- **One-way vs round-trip emphasis:** deal clubs usually headline round-trip prices. Which does v1 detect/publish?
- **Testing:** live-API tests are flaky (429). How to test the scanner deterministically (recorded fixtures)?
- **Proxies/egress:** start single-IP; when do we need rotating residential proxies, and is that legally OK?

---

## 10. Explicitly deferred (not v1)
Public site, SEO pages, newsletter delivery, accounts, Stripe, premium gating, push notifications, Elite tier, ancillary partners, B2B feed, multi-language content, mobile app.

---

## Questions for the reviewer (please answer these directly)

1. **What's missing for a credible v1** that isn't listed above?
2. **R0 (audience conversion):** What's the cheapest way to test TikTok → owned audience → paid *in parallel* with deal supply? Which conversion benchmarks matter (view→sub, sub→reply, sub→paid)? **Telegram vs email** as the primary owned channel in Lithuania? Which TikTok format converts deal-watchers into subscribers?
3. **R2 (deal supply):** Will **VNO + KUN + RIX** (PLQ as bonus) yield enough good deals/week to sustain a paid newsletter? Will Lithuanian travelers accept **RIX/WAW** departures?
4. **R1 + R5 (legal + affiliate):** Which *production* flight-data source is EU-legal for a deal-alert product **and** affiliate-enabled? Is the reverse-engineered Google API acceptable for the **private phase only**, or a ticking bomb even there? How do Going / Jack's Flight Club actually source + monetize legally?
5. **R4:** Best cold-start "is this a deal?" baseline with no price history?
6. **Scoring:** Is the 4-gate + weighted-Deal-Score model sound? Better-known approaches?
7. **Data model:** Any tables/fields/indexes missing? Anything over-engineered for v1?
8. **R3:** Do you agree mistake fares should be a *later premium feature*, not a v1 hook (brand around curated Baltic deals instead)?
9. **Biggest risk overall:** if you had to bet on what kills this project, what is it, and what's the cheapest experiment to de-risk it first?

*Give options and opinions, not a single verdict.*
