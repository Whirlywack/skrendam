# Pilot research — Baltic flight-deal subscription (Yip/Skrendam)

_Date: 2026-06-12. Deep research run: 5 parallel research agents (demand, local market,
global clubs, AI features, newsletter economics) + 2 adversarial verification agents on
the load-bearing claims. All claims sourced; verification verdicts noted inline.
Companion note: `2026-06-12-deal-profiles-discovery.md`._

## 0. Verdict

**The idea validates.** The market is real (~16M annual Baltic airport passengers,
growing), the gap is verified (**no curated, paid-tier flight-deal product serves
LT/LV/EE today** — adversarially checked), the closest analogue economics are better
than feared (Jack's Flight Club ≈ **$4.6M/yr revenue, ~4–5% free→paid** — corrected
from an initial ~1.5% misread), and a same-size-market precedent exists (Zetland,
Denmark, 6M people: 70k paying members, €10M revenue). The constraint is not demand
or competition — it's **funnel execution** (TikTok/FB → email) and **deal supply
breadth** (route expansion + history accrual). Both are testable in a 90-day pilot.

## 1. Market (verified)

- Lithuanian airports: record **7.16M pax 2025** (VNO 5.11M +6.4%, KUN ~1.6M +12%,
  PLQ 448k), overtaking Riga for the first time in 20+ years; 7.8M forecast 2026.
  RIX ~7.1M (of which ~20% transfers → true LV origin market ~5.7M). TLL 3.49M.
  **CONFIRMED** (aviation24.be, riga-airport.com, airport.ee, Jan 2026).
- Carrier mix: Ryanair largest at VNO (~28% seats), Wizz VNO capacity +39% YoY;
  airBaltic 57% of RIX; airBaltic 30% / Ryanair 13% at TLL. LCC density = deal supply.
- Top routes are VFR/city-hubs: London #1 at RIX and top-5 (combined airports) at VNO;
  Oslo, Dublin, Helsinki core. Organized sun travel is charter-dominated (Novaturas;
  LT package trips: Turkey 37%, Greece 13%, Egypt 10%) — meaning *self-booked sun on
  LCCs is the under-served wedge* the engine already targets.
- Diaspora: LT diaspora heavily UK/Ireland/Norway (~144k LT-born in UK at peak);
  LV ~370k abroad (dated 2012 estimate; UK share unconfirmed); EE 126,781 citizens
  abroad (Finland ~50k largest). **PARTLY TRUE** as stated — direction solid, some
  figures dated. VFR is a structural, recurring demand corridor.
- Travel spend rising in all three countries (LV €1.8B on trips last year; EE 3.1M
  outbound trips 2024, €1.2B).

## 2. Competition (every site checked live, June 2026)

| Player | Market | Model | Email? | Paid tier? | Weakness |
|---|---|---|---|---|---|
| PigusBilietai.lt | LT | WP deal blog + FB (~37k) | no signup found | no | no alerts, no history evidence, dated UX |
| Lektuvelis.lt | LT | thin SEO/affiliate (Kiwi white-label; even payday-loan links) | claimed, boilerplate | no | no editorial product at all |
| Makalius.lt | LT | deal media + licensed tour operator (biggest LT brand) | free | no | package-centric; flights secondary |
| skrydziai.lt + clones | LT | parked / OTA white-labels | — | — | inactive |
| Leti-lidojumi.lv | LV | thin SEO, stale (Oct 2025) | no | no | **Latvia is a greenfield** |
| Trip.ee | EE | forum + daily deal feed + destination alerts | web-first | no | EE-only, no email digest |
| Reisidiilid.ee | EE | strongest Baltic op: daily deals + weekly email + own tour arm | weekly, free | no | no personalization, EE-centric |
| Travelfree.info | CEE/EN | daily blog incl. Baltics tab, long-haul deals | free | no | EN-only, deals buried in 13 regions, promo-code clutter |
| Fly4free.pl | PL | category king (~883k FB, app + airport push) | yes | no | zero Baltic-language presence |
| Azair.eu | CZ | self-serve LCC meta-search | — | no | power-user tool, intimidating |

**Verified gap (proved-negative checked in LT/EE/LV languages):** nobody in the region
has a paid tier, departure-airport personalization, price-history evidence ("usually
€X"), or booking-deadline guidance. The region's incumbents are affiliate feeds; trust
is their weakest asset (payday-loan links!). **Latvia has no active curated product at
all.**

## 3. Customers — what Balts are looking for

Segments (mapped to existing `audience_segments` + two additions):

1. **Family planners** (school-holiday sun, 7–14d RT, strict itineraries, plan 2–6mo
   out) — currently forced into Novaturas packages; "package-quality sun without
   package prices" is the message.
2. **Budget spontaneous** (≤€40 one-ways, leave-this-weekend; students/young urban) —
   today served by scrolling FB feeds; wants push speed.
3. **Couples/shoulder-season** (Sep sun, Christmas markets, city breaks).
4. **VFR/diaspora** (NEW) — recurring London/Dublin/Oslo/Helsinki travel, fixed route,
   price-watch behavior, Christmas/Easter peaks. No incumbent serves "watch my family
   route." Note: this segment is partly *in* the UK/IE/NO, booking flights *to* the
   Baltics — the product can serve both directions of the same corridor.
5. **Long-haul aspirational** (NEW) — 1–2 big trips/yr; Travelfree proves supply
   exists (Vilnius/Riga–Singapore €560, –Lima €722); the "one deal pays the
   membership" story.

Channels (**verified, nuanced per country**): Lithuania = Facebook/Messenger (54%
population Messenger reach) + email; Estonia = WhatsApp is the leading messenger;
Latvia = Telegram was the #1 downloaded messenger Q2 2024. So: **email is the spine
everywhere; the "fast channel" must be per-country** (FB/Messenger LT, WhatsApp EE,
Telegram LV) — or simply Telegram+WhatsApp broadcast channels both, cheaply.

Language: EN works for young urban early adopters (EE #20, LT #23 EF EPI), but
mass-market conversion needs local language. **LT-first, EN parallel, LV/EE editions
later** is the rational sequence given LT has 40% of the Baltic market and the
freshest funnel (TikTok).

## 4. Features — steal, improve, and AI-native

### Steal (ranked, from global teardown)
1. "Normal price vs deal price" evidence line (Going) — *we can beat it: real
   percentile from `price_log`, e.g. "cheapest 5% of the last 12 months", with a
   sparkline. Nobody shows actual data.*
2. Estimated deal lifespan / "book by ~X" (Going) — *we compute fare half-life from
   our own time series; honest stats, not gut feel.*
3. Free = teaser subset + delayed; Paid = everything + first access (JFC/Going).
   Architecture already locked (premium_at/public_at design input).
4. Preferred departure airports — trivial with 4–5 airports; table stakes.
5. Destination watchlist (Going Premium) — answers #1 churn complaint ("never deals
   where I want to go").
6. Booking instructions + exact bookable dates in-email, OTA-vs-direct guidance.
7. Grandfathered "price for life" + long money-back guarantee (Thrifty) — zero build.
8. Concierge/custom search requests (Matt's Flights) — perfect solo-founder moat;
   fli automates the search, founder curates the answer.
9. Savings counters (aggregate + per-member) in every email footer.
10. Fast error-fare channel (Secret Flying's WhatsApp) — per-country messenger.

### Churn lessons to design against
Billing transparency (DFC's reputation damage), deal-relevance fatigue (hub bias),
email overload without a web archive (site already exists → archive is free).

### AI-native (feasibility-ranked for a solo founder; market-verified)
| Feature | Effort | Differentiation |
|---|---|---|
| 1. Deal urgency + percentile from own `price_log` ("bottom 8% of 12 months; deals like this last ~3 days") | S–M | **High** — nobody does it; honest data beats Hopper's soft "95%" claims |
| 2. LLM trip-assembly block per deal (3-day sketch, hotel ballpark, weather that month, local-holiday fit) | S | **High** — exists in planners, absent from deal emails |
| 3. Natural-language preferences → structured filters ("Rome under €40 in autumn" → template/watchlist) | M | Med-High — magic onboarding; one LLM parse to existing schema |
| 4. Per-country messenger bots (Telegram LV, WhatsApp EE) for instant alerts | M | Med — proven (AirTrackBot 1.6M users); retention channel |
| 5. Per-subscriber LLM digest (rank+rewrite per prefs) | M | Med — viable at 10k subs; needs #3 first |
| Avoid: price *prediction* promises (Google owns the baseline; credibility risk), conversational planner chatbot (losing fight vs ChatGPT), agentic auto-booking (bot-blocking + liability) | | |

Principle: **AI writes around verified numbers from our own scan, never generates
facts.** The defensible asset is `price_log` + the scoring engine; AI is presentation.

### Threat assessment (verified)
Google's AI "Flight Deals" (global Nov 2025) is **pull-based only** — no proactive
alerts. The deal-club value proposition (proactive, curated, local) is undisrupted.
Platform AI commoditizes *search*, not *watching on your behalf*.

## 5. Business model (with verified anchors)

- **Anchors:** JFC £48/yr at ~$4.6M revenue (FY2024, Travelzoo 60% owner), implying
  ~80–110k payers from ~2.3M list (**~4–5% conversion** — corrected upward in
  verification). Going's historical 10–12% was at a $2/mo price (2017) — treat as
  ceiling, not base. Newsletter-industry median ~3%.
- **Baltic pricing context:** Spotify EE/LV €11.99/mo; Delfi Plius ~€5/mo. A deal club
  at **€29–39/yr (€2.50–3.25/mo)** sits comfortably under streaming and beside news
  paywalls. Launch lever: founding-member price-for-life.
- **Affiliate reality:** Aviasales/WayAway ~1.1% of ticket, Kiwi ~3% — €1–3/booking on
  Baltic fares. Supplementary (JFC makes ~$18/member/yr transactionally), never primary.
  Reinforces R1: monetization is subscriptions, so the fli ToS risk is about data
  continuity, not affiliate attribution.
- **Year-1 funnel (defensible ranges, verified inputs):** LT TikTok/IG 300k–1M
  views/mo → 0.1–0.4% to email (clicks ~0.5–2% × signup 10–30%) + referral program
  (+20–35%; Morning Brew got 35% of list from referrals) → **8k–20k free subs by
  month 12** → 2–5% paid at €29–39 → **160–1,000 payers, €5k–35k sub revenue** +
  €1–5k affiliate. Long-run Baltic ceiling (Zetland analogy, ~0.3–0.5% of adults):
  **10–30k payers ≈ €300k–1M ARR.**
- Tooling cost year 1: €0–600 (beehiiv/Resend tiers). GDPR: double opt-in already
  built into `site/`.

## 6. The 90-day pilot plan

**Thesis to falsify:** "Baltic travelers will join an email list for curated local
deals at ≥X rate, engage at ≥Y, and ≥Z% will pre-commit to paid."

### Phase 0 (week 1–2) — supply foundation
- Expand routes 14 → ~120–150 (full meaningful VNO/KUN/RIX network + TLL pilot set),
  in **staggered cohorts** (~⅓ network/day) respecting the gating data (33/40 searches
  blocked once). History accrual starts now; `drop`/`rarity`/`error_fare` go live
  per-route after ~8–10 daily points.
- Add 2 templates: VFR watch (LON/DUB/OSL corridors), long-haul opportunist.
- Adopt the marketability gate: ≥5 viable departure dates for "planable" deals
  (exempt: error fares, last-minute).

### Phase 1 (week 2–6) — funnel test (R0)
- LT-first: TikTok account posting 1 deal/day (vertical card: route, price vs
  "usually" percentile, dates, "link in bio") + FB page mirroring. The deal feed
  exists; content is generated from `published_deals` (AI drafts copy, founder
  approves — CopyDrafter already exists).
- Email capture on `site/` (built); weekly digest starts immediately
  (the missing piece to build: send pipeline on Resend, deals → newsletter template).
- Per-country fast channels: free Telegram channel (LV/RU-speakers) + WhatsApp
  channel (EE later); LT relies on FB + email.
- **Metrics/kill bars (4 weeks of data):** views→email ≥0.1% (kill if <0.05% after
  iteration); email open ≥40% (deal newsletters run high); deal CTR ≥8%;
  weekly list growth ≥10%.

### Phase 2 (week 6–12) — willingness-to-pay test
- Don't build billing yet. Run a **founding-member pre-sale**: "€29/yr price-for-life,
  first 200 members; early access + watchlists when they ship" — Stripe payment link,
  zero code. Uusi Juttu pattern (13k prepaid before launch — directionally, not scale).
- **Metric:** ≥2% of engaged free list pre-commits → build Spec 3 billing. <1% →
  stay free + affiliate, revisit positioning.
- In parallel ship the two cheap differentiators: percentile evidence line + "book by
  ~X" half-life estimate on every published deal (data exists; thin compute).

### Explicitly deferred
LV/EE language editions (after LT funnel proves), per-subscriber LLM digests (needs
prefs volume), apps/push (messenger channels suffice), agentic booking (no), data-source
migration (R1 — revisit at first paying cohort; subscription model lowers urgency).

## 7. Risks (updated)

1. **R0 funnel** remains #1 — all pilot Phase 1 exists to retire it. Mitigation:
   deal content is natively viral; referral mechanics from day one.
2. **R2 supply breadth** — route expansion is now urgent for a second reason: history
   accrual gates the best scorers. Cohort pacing vs Google gating needs live tuning.
3. **R1 data source** — unchanged stance (private phase OK), but subscription-led
   monetization (not affiliate) means the migration target is about *reliability*,
   not attribution. Budget a SerpApi/licensed cross-check when revenue exists.
4. **Free-ecosystem retaliation** — Travelfree/Reisidiilid could copy the paid tier.
   Moat: price history depth (compounds daily), local language, multi-origin
   arbitrage, curation trust. Speed matters: the data moat starts accruing when routes
   expand.
5. **Verification caveats:** LV diaspora UK-share unconfirmed; affiliate EPC band is
   an estimate (possibly pessimistic — Skyscanner CPC ~$0.40–1.00); Going's 10–12%
   conversion is 2017-era at $2/mo pricing.

## 7A. Founder decisions (recorded 2026-06-12)

1. **Language:** LT-first on site + emails, EN kept as parallel. (Site is currently
   EN-only, hardcoded strings, `lang="en"` — localization is real frontend work.)
2. **TikTok cadence:** 1 deal video/day confirmed doable. Engine already models
   `tiktok_hook` on templates/drafts/published deals — extend to full script drafts.
3. **Willingness-to-pay:** early founding-member pre-sale approved (€29/yr
   price-for-life, first 200, Stripe payment link, no billing build).
4. **Scope:** LT+RIX deep (~120–150 routes, staggered cohorts), **no TLL** in pilot.

## 8. Sources (primary)

Market: aviation24.be (LT airports 2025), riga-airport.com, airport.ee, osp.stat.gov.lt,
stat.ee, datareportal.com Digital 2025 Lithuania, EF EPI 2024/25, globalestonian.com,
en.wikipedia.org/wiki/Latvian_diaspora, lsm.lv. Competitors: pigusbilietai.lt,
lektuvelis.lt, makalius.lt, leti-lidojumi.lv, trip.ee, reisidiilid.ee, travelfree.info,
fly4free.pl, azair.eu, wakacyjnipiraci.pl. Clubs: going.com/premium + /elite + /how-it-works,
jacksflightclub.com + helpscoutdocs, dollarflightclub PRNewswire (Jan 2025),
secretflying.com/alerts, stacksocial (Matt's), dailydrop.com/pro, thriftytraveler.com/premium,
trustpilot.com (Going/JFC/DFC), indiehackers.com Scott's interview (2017),
prnewswire.com Travelzoo Q4-2024 results (JFC $4.63M FY2024). AI: blog.google
(AI Flight Deals), techcrunch.com (Nov 2025 global rollout), hopper.com, skift.com
(ChatGPT agent mode), airhint.com, airtrackbot.com, datadome.co. Economics:
simonowens.substack.com, yana-g-y.com, travelpayouts.com (Aviasales/Kiwi rates),
partners.airalo.com, beehiiv.com/pricing, resend.com/pricing, pressgazette.co.uk +
niemanlab.org + journalism.co.uk (Zetland/Uusi Juttu), cybernews.com (Spotify Baltics),
referralrock.com + sparkloop.app (Morning Brew).
