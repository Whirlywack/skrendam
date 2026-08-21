# Discovery synthesis — deal profiles, FLI capability map, competitor logic, users

_Date: 2026-06-12. Founder-requested deep dive before building the next round of
Python modules ("profiles + how we look for deals"). Sources: this repo's docs/research,
the skrendam engine source, upstream fli GitHub docs, and web research on Going /
Jack's Flight Club / Dollar Flight Club / Secret Flying and the LT market._

## 1. Where the repo actually is (more than "not there yet")

The profile scaffolding already exists — it's just thin, not absent:

- **Engine (Spec 1, shipped):** two-tier scan (`SearchDates` calendar → `SearchFlights`
  detail on anomalies), `price_log` (1,846+ points at last tuning), window baselines,
  four scoring strategies (`weighted`, `drop`, `rarity`, `error_fare`), quality tiers
  (rare ≥94 / great ≥88), dedup, scan-health verdicts, recheck + expiry sweep.
- **Curator admin (milestone 2, shipped):** queue, published board, scans, copy drafter,
  and config CRUD for zones / routes / templates / audiences / moments.
- **The "profile" concept = `DealTemplate` = audience × moment × constraints.** Seeded:
  5 audiences, 6 moments, 6 templates, 6 zones, **14 routes** across VNO/KUN/RIX.
- **Tuning state (2026-06-03):** GREAT_THRESHOLD 0.88; family template tightened to
  30%/€300; SEND_THRESHOLD 0.55 unchanged.
- **Locked design inputs from JFC notes (2026-06-03):** (1) data-driven "act by ~X"
  availability window from `price_log`, (2) tiered release timing (premium_at/public_at),
  (3) speed-as-the-premium-good as an architecture spine.

- **Public site (`site/`, port 3001) — further than first assessed:** homepage
  ("opportunity inbox"), deal detail, past-deals archive, collections, subscribe with
  double opt-in (Resend, off until `RESEND_API_KEY`), early-alerts page, SEO/GEO slugs.
  Recently merged: fli-resilience, degraded-scan banner, unverified-since chip.
- **Ops:** daily scan via launchd 06:00 Europe/Vilnius on the dev Mac; adapter paced
  ~0.67 req/s with circuit breaker; `skrendam worker` polls `scan_requests` for
  admin-triggered rechecks.

**The real gaps:** the search space (14 routes is a toy set vs ~80–100 real destinations
per origin), the template library (6 starter profiles), any notion of *user-side*
profiles (subscriber preferences/watchlists), and email *sending* (capture exists; no
newsletter pipeline). R0 (audience conversion) remains open — the surface exists but the
TikTok → subscriber funnel is untested.

## 2. FLI capability map (what the engine can and cannot ask for)

Confirmed against upstream `punitarani/fli` (v0.8.1) + this fork's docs.

**Can:**
- `search_dates` — price-per-date calendar, one-way or round-trip (with `trip_duration`),
  61 days/request (auto-chunked), ~305 days ahead, day-of-week filters. Price only, no
  itinerary detail. This is the cheap broad-scan primitive.
- `search_flights` — full itineraries: price, legs, stops, duration, layovers (incl.
  overnight / airport-change / self-transfer / mixed-cabin), airline, aircraft, legroom,
  amenities. Filters: cabin (ECON→FIRST), max stops, layover min/max bounds,
  airlines/alliances include+exclude, departure/arrival time windows, bags,
  exclude-basic-economy, currency/`hl`/`gl` locale. Multi-airport origins/destinations
  per query (comma-separated). Every result carries a deterministic `tfs` booking deep link.
- `get_booking_options` — vendor fares per itinerary; **unreliable** (often empty without
  a browser session token); no affiliate attribution. Deep link is the fallback.
- Multi-city itineraries (`fli multi --leg ORIGIN,DEST,DATE …`) — this fork is ahead of
  upstream here (May-2026 filter additions: alliances, exclusions, layover bounds, locale).
- Multi-airport origin/destination per query (comma-separated) — the primitive behind
  multi-origin arbitrage (§5.4).
- Same engine in Python (primary), TypeScript port, CLI, MCP.

**Cannot (these shape everything):**
- No "explore anywhere from X" — strictly route-based. **Our destination list IS the
  search space**; a deal on a route we don't enumerate is invisible to us.
- No Google price-level benchmark ("low/typical/high") — we compute our own baseline
  (done) ; SerpApi `price_insights` remains the cheap cold-start cross-check option (R4).
- Rate-limited, ToS-grey. Fine for the private phase; not a production-paid foundation (R1).

## 3. How the incumbents actually find deals

| Service | Detection | Curation | Notes |
|---|---|---|---|
| **Going** (2M subs) | "95% legwork" — experts scanning all day; tech-assisted, not algorithm-led | 35+ human Flight Experts | Hard criteria: price vs usual fare, no budget airlines, nonstop/1-stop full-service only, manageable layovers, **≥10 departure dates per deal** |
| **Jack's Flight Club** | Automated anomaly/error-fare scan | Human "Navigators" verify everything pre-send | Premium (£48/yr) = ~4× deals + first access + airport prefs; **speed is the paid good**; each alert has an expected-availability window + book-direct guidance |
| **Dollar Flight Club** | Mostly automated | Light | The cautionary tale: ships junk "deals" (e.g. $350 NYC→Toronto), destinations under travel warnings |
| **Secret Flying** | Error-fare algorithm | None — free data dump | Bare-bones; users wade through noise |

**Takeaways:** (a) the winning pattern is exactly ours — automated surfacing + human gate;
(b) curation quality is the moat, automation alone produces DFC; (c) Going's "≥10 departure
dates" rule is a marketability gate we don't have yet; (d) we're already *more* data-driven
than JFC's gut-feel availability windows — price-history half-life is a genuine edge.

## 4. Users — LT market

**Demand proxies exist but are badly served:** Pigūs skrydžiai (FB, Vilnius),
PigusBilietai.lt (~36k likes), Lektuvelis.lt (~17k, Kaunas). All Facebook-native,
uncurated, affiliate-heavy. No curated, trust-first, alert-speed product in the market.
Newsletter-subscriber research skews Gen Z/Millennial, discount-motivated; the core JTBD
is **"tell me when it's worth going, so I don't have to watch"** — flexibility-first,
destination-second.

**Persona → existing audience segment mapping (plus two missing ones):**

| Persona | Segment | Journey shape | Status |
|---|---|---|---|
| Family planner | `families` | RT 7–14d, school holidays, strict itineraries, plans 2–6 mo ahead | seeded |
| Budget spontaneous (students/young) | `budget` | OW/weekend, ≤€40 psych price, leaves this Friday | seeded |
| Couple / shoulder-season | `couples` | RT 3–7d, Sep sun, Christmas markets | seeded |
| Flexible opportunist | `flexible_adults` | "anywhere cheap", date-agnostic | seeded |
| **Diaspora / VFR** | — missing | Fixed route (STN/DUB/OSL/LTN…), recurring, price-watch on *their* route, Christmas/Easter peaks | **add** |
| **Long-haul aspirational** | — missing | 1–2 big trips/yr, Asia/US, premium-economy curious, the "one deal pays the membership" story | **add** |

VFR is the structurally underserved one: a huge share of LT air traffic is
diaspora-driven, the routes are known and few, and no incumbent does "watch my family
route" as a product.

## 5. Differentiation candidates (not-a-JFC-copy list)

1. **Credible "act by ~X"** — fare half-life from `price_log` + recheck recency badge
   ("still live — re-checked 2h ago"). JFC asserts; we can show. Already a locked input.
2. **Trip-shaped deals, not route deals** — lean into moments/audiences as the *public*
   product: newsletter sections by life-situation ("School-holiday sun", "Leave this
   weekend"), not by route. The schema already thinks this way; no competitor's UX does.
3. **VFR watchlists** — "my route" subscriptions for diaspora corridors; recurring,
   retention-friendly, premium-gateable.
4. **Multi-origin arbitrage** — VNO vs KUN vs RIX priced side-by-side in one alert
   ("fly from Kaunas, save €38"). fli supports multi-airport queries natively; uniquely
   sensible in a small country with 3 reachable airports (+WAW later).
5. **One-way pairing** — build weekend RTs from two one-way calendars (Fri out / Sun–Mon
   back); catches LCC pricing that round-trip-headline competitors miss.
6. **Marketability gate à la Going** — require N viable departure dates (calendar already
   gives this for free) before a candidate is publishable.
7. **Tiered release timing** — premium_at/public_at (locked input #2); speed as the paid
   good from day one of Spec 2.

## 6. Proposed deal taxonomy (for discussion)

- **Drop** — sharp fall vs route's own history (`drop` scorer) → urgency framing.
- **Rare low** — at/near historical minimum (`rarity` scorer) → "cheapest we've seen".
- **Seasonal value** — template-matched moment deals (family sun, Sep sun, Xmas markets) →
  planable, the newsletter's bread and butter.
- **Psych-threshold** — under €40/€50 absolute (last-minute weekends) → impulse.
- **VFR watch** — threshold crossings on diaspora routes → personal alert, premium.
- **Error fare** — `error_fare` scorer; later premium feature per R3 (downgraded, agreed).
- **Premium cabin** — business/PE dips (fli supports cabin filter); Spec 4 elite tier.

## 6A. What the two 06-11 initiatives change (read after first draft)

Both June-11 plans are **merged**, and they reshape the priorities above:

- **Multi-strategy scoring** already implements half of §6's taxonomy as code: `drop`
  (≥20% fall vs last scan), `error_fare` (≥30% below the recorded floor, ≥8 history
  points — the absolute-implausibility signal the JFC note deferred), `rarity` (cheapest
  decile ever, ≥10 points), each persisted per-candidate in `candidate_scores` with a
  template-chosen headline (`primary_scorer`). New deal types = a new `Scorer` class +
  a template — the seam is built. What §6 adds on top is *taxonomy as positioning*
  (which scorer leads which newsletter section), not engine work.
- **History is the fuel — and it's per-route.** Three of four scorers are quiet until a
  route has ~8–10 daily scan points. **Every route added starts at zero history**, so the
  route-network expansion (§7.1) is even more urgent than supply alone suggests: a route
  added today becomes fully scoreable only ~2 weeks later.
- **fli-resilience caps scan ambition.** Real data: Google gated 33/40 calendar searches
  90 minutes after an identical clean run. Expanding 14 → 150–250 routes multiplies
  exposure; the expansion plan needs pacing math and probably staggered route cohorts
  (e.g. a third of the network per day), accepting slower history accrual per route.
- **The trust substrate for the "act by ~X" differentiator (§5.1) now exists:**
  `unverified_since`, empty-recheck-never-expires, degraded verdicts. The honest
  freshness badge is a thin read on data already maintained.

## 7. Open questions for the founder

1. **Search-space expansion:** grow routes 14 → full VNO/KUN/RIX destination network
   (~150–250 routes)? Source list from airport/Wizz/Ryanair network pages; pacing math
   needed for daily-scan budget.
2. **Which two new templates first** — VFR watch and/or long-haul aspirational?
3. **RT vs OW emphasis** for published deals (incumbents headline RT; LCC reality is OW).
4. **Distribution (R0):** Telegram channel + email capture now, in parallel — still the
   intent? Telegram-first fits LT habits and is the cheapest test.
5. **Marketability gate:** adopt Going's "≥N departure dates" rule? Suggested N=5–10.
