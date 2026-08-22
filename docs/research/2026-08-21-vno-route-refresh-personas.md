# VNO route refresh + persona expansion — research

_Date: 2026-08-21. Web research (flightconnections.com 2026-08-02, airportinformation.com
2026-08-15, vilnius-airport.lt, airline announcements) cross-checked against the 50-route
VNO seed on PR #8 (`feat/route-expansion`, researched June 2026). Companion to
[2026-06-12-deal-profiles-discovery.md](2026-06-12-deal-profiles-discovery.md)._

**Status: research only. No seeds changed. Route additions are frozen until the BotGuard
supply decision (see handoff 2026-08-21 §0.5) — every conclusion here rides along on the
PR #8 refresh, whenever that unfreezes.**

## 1. VNO network as of August 2026

60 nonstop destinations, 31 countries, ~19 airlines (~399 flights/week). Wizz Air,
airBaltic and Ryanair carry most traffic; Wizz based a third aircraft in Vilnius for
winter 2025/26 and keeps expanding.

### Delta vs the PR #8 seed (50 routes, June 2026)

**New / missing from the seed (~12):**

| Route | Airline(s) | Season | Note |
|---|---|---|---|
| VNO–GVA Geneva | airBaltic | Jan–Mar | **Ski.** Returns winter 2026/27 (announced May 2026) |
| VNO–GNB Grenoble/Lyon | Wizz | winter–spring | **Ski.** The classic Alps-charter airport |
| VNO–TRN Turin | airBaltic + Ryanair | year-round | **Ski** gateway; airBaltic markets it as Alpine |
| VNO–DXB Dubai | airBaltic + **flydubai** | from Oct 2026 | Two carriers on a new route → price war likely |
| VNO–TSF Venice-Treviso | Ryanair | year-round | City-break |
| VNO–TLL Tallinn | Wizz (daily) + airBaltic | year-round | Intra-Baltic — skip as deal route (bus-competitive) |
| VNO–RIX Riga | airBaltic | year-round | Same — skip |
| VNO–HAM Hamburg | airBaltic | year-round | |
| VNO–NUE Nuremberg | Ryanair | seasonal (Aug–Oct listed) | *The* Christmas-market city if extended to Dec |
| VNO–DUS Düsseldorf | airBaltic | Aug–Jan | VFR/city |
| VNO–NRN Weeze | Ryanair | Feb–Mar | |
| VNO–TGD Podgorica | Wizz | Aug–Oct | Balkan shoulder |
| VNO–TKU Turku | Wizz | Aug–Sep | Marginal |

**Possibly dropped since June (verify before touching seed):** VNO–FCO (only Ciampino
listed now), VNO–LPA (only Tenerife listed for Canaries). Both are in the PR #8 seed.

**Data glitch, ignore:** "UTair year-round to Hurghada" — a Russian carrier cannot fly
EU; this is mislabeled charter traffic. Charter fares are invisible to Google Flights /
fli anyway, so Egypt stays out of scope regardless.

### Structural observations (worth more than any single route)

1. **The schedule is shoulder-shaped.** Greece (ATH/CFU/HER), Tirana, Podgorica run
   ~Aug–Oct only; ski routes (GVA/GNB, NRN) run ~Jan–Mar only; several others
   (LIS, DUS, EIN, HHN, NUE, BLL) are seasonal. Scanning a dormant seasonal route wastes
   quota — which is expensive at ~15% BotGuard throughput. → Route rows need a **season
   window** (see §4).
2. **Multi-carrier routes are the volatility engine:** BER (×3: airBaltic/Ryanair/Wizz),
   TLV (×3), LTN, OSL, BCN, AGP, PRG, VIE, TRN, EIN (×2 each), DXB (×2 from Oct).
   Fare wars produce deals; weight these as core scan routes.
3. **Rome and Gran Canaria may have quietly shrunk** — the June seed can't be re-run
   blindly.

## 2. Persona / bundle proposals (grounded in the network)

Existing seeded audiences: families, couples, flexible_adults, budget, city_break.
June discovery already flagged **VFR/diaspora** and **long-haul aspirational** as missing.
The route reality adds/sharpens:

| Persona | Route evidence | Proposal |
|---|---|---|
| **Diaspora / VFR** | STN+LTN, DUB, OSL (×2), BGO, EIN, HAM, DUS | **Add first.** "Watch my route" — recurring, retention-friendly, premium-gateable, no LT incumbent does it. Peaks at Christmas-booking season (Sep–Oct). |
| **Winter-sun escaper** | DXB (×2), TFS, LCA, AGP, MLA, TLV | **Add second.** Fills the Nov–Mar hole in MOMENTS (nothing between xmas_markets and plan_ahead_summer). Marketable the week Dubai launches (Oct). |
| **Baltic skier** | GVA, GNB, TRN, ZRH, MUC | **Add before December.** New moment "ski season" (late Dec–Mar), Sat–Sat + long weekends. Needs an **ALPS zone** — today TRN/GVA/GNB would mis-cluster as CITY_BREAKS/MED. |
| **Long-haul aspirational** | Only DXB/IST/TLV nonstop; rest connect via IST/FRA/WAW | **Keep narrow:** "Dubai + one-stop via hubs" watch, not a broad persona. The VNO network can't support more. |
| **Balkan explorer** | TIA, TGD, ATH, CFU — all Aug–Oct | **Bundle, not persona:** "warm, cheap, un-crowded autumn" content angle inside budget/couples templates. |

**Skipped deliberately:** intra-Baltic hops (bus-competitive, no deal psychology);
events/festival persona (no route signal — YAGNI).

## 3. Sequencing recommendation

1. **Now:** this doc. No seed/route changes.
2. **After the 06:00 scan verdict** (handoff §0.5 decision tree): the supply decision
   gates everything below.
3. **Personas next (cheap, zero scan cost):** seed VFR + winter-sun audiences/moments/
   templates. Natural deadlines: VFR ~Sep (Christmas booking opens), winter-sun ~Oct
   (Dubai launch). Ski template before Dec.
4. **Routes once, with PR #8:** fold the §1 delta into the PR #8 seed refresh (add ~10,
   re-verify FCO/LPA, add season windows, promote multi-carrier routes to core).
   Never add routes while supply is unsolved — a new route at 15% throughput accrues
   scorer history ~6× slower (3 of 4 scorers need 8–10 points).

## 4. The "calendar" question

Schedules mostly change on **two fixed dates a year** — the IATA season boundaries:
last Sunday of October (winter; next: **2026-10-25**) and last Sunday of March (summer;
next: 2027-03-28). Seasonal-route windows are published in schedule data
(flightconnections lists start/end months per route).

So: **not a new system.** A `season window` column on route rows (skip scanning outside
it), refreshed manually twice a year at the IATA boundary + when airlines announce.
No schedule-change watcher — the scan itself flags dormancy (a route whose calendar goes
permanently empty), though note that signal is currently confounded with BotGuard gating.

## 5. Open questions for the founder

1. ~~Tallinn as origin?~~ **Answered 2026-08-21:** long-term plan is VNO + KUN + RIX +
   TLL. Network research pass done — see §6. Route seeding still waits on the supply
   decision like everything else.
2. Which of VFR / winter-sun / ski to seed first (recommendation above: that order)?
   **Update:** all three drafted in
   [2026-08-21-template-drafts-vfr-winter-sun.md](2026-08-21-template-drafts-vfr-winter-sun.md).
3. Does the ALPS zone justify a new `zones` row, or is `included_destinations` on the
   ski template enough for v1? (Lean: template-only for v1 — that's what the draft does.)

## 6. TLL network research pass (2026-08-21)

Sources: 2lnr.com (data 2026-08-19), aerocorner.com (2026-08-02),
directflightsfrom.com (2026-05-26). ~44–52 nonstop destinations, ~20 carriers.

**Structure differs from VNO in one important way: airBaltic dominates (25 routes, ~38%;
Ryanair 6, Wizz 5).** A single-carrier-heavy network produces fewer fare wars than VNO's
three-way LCC fight — expect fewer drop-type deals per route. Multi-carrier routes (the
volatile ones): OSL, LGW, BER, BCN, CPH, AYT.

Persona-relevant clusters (destinations confirmed current):

| Cluster | TLL destinations | Fit |
|---|---|---|
| Winter sun | AGP (year-round), TFS, PMI, MLA, AYT, plus Paphos returning | `winter-sun-escape` works from TLL as-is |
| Ski | **SZG (Salzburg — TLL-only, no Baltic sibling)**, GVA (airBaltic winter), ZRH, MUC, MXP as gateways | `ski-alps` draft already includes SZG |
| VFR | OSL, LGW, DUB (returning), CPH, ARN; HEL is the mega-corridor (9–11×/day Finnair) but ferry-competitive | vfr-watch destination list would need an EE variant (OSL/LGW/CPH/ARN vs the LT list) |
| City breaks | BER, PRG, VIE, CDG, AMS, FCO, VCE, MXP, NCE, BCN, WAW, GDN, IST, KUT | standard |
| Shoulder Balkans/Greece | RHO, SPU, BOJ, TIA | same Aug–Oct shape as VNO |
| Charter-only (invisible to fli) | SSH, HRG, AQJ, some TFS | skip |

**Scope status:** founder says "maybe" — research done, no TLL routes seeded, decision
rides with the post-supply-verdict route refresh. Estonian-language/market implications
(site copy, GDPR notices are EE vs LT) are out of scope for the engine and belong to a
later product decision.

## 7. Connecting flights — founder decision (2026-08-21)

Decision: **connecting deals are in scope.** Rationale: Lithuania has almost no long-haul
directs (only DXB/IST/TLV from VNO), so a directs-only newsletter structurally cannot
serve the long-haul appetite.

Two regimes, treated differently:

1. **Protected connections (single ticket, what fli/Google price).** Standard product.
   No disclaimer needed — a missed connection is the airline's to fix (rebooking,
   EU261 care). The `long-haul-opportunist` template (PR #8, `max_stops=2`) is the
   existing vehicle; the missing piece is routes: an aspirational one-stop cohort
   (~5–10: e.g. BKK, JFK, NRT, DXB-beyond via IST/FRA/WAW hubs), added post-supply-
   decision like everything else.
2. **Self-transfer combos (two separate tickets).** Only ever published with explicit
   own-risk framing: "separate tickets — if you miss the connection it's your problem;
   we recommend N-hour buffers / carry-on only / travel insurance." The engine cannot
   price these today (one-way pairing, discovery doc §5.5, is unbuilt). Deferred — but
   the copy rule is decided now so it doesn't get relitigated per-deal.

## 8. Deal imagery — founder decision (2026-08-21)

Approved approach: **pre-generated destination image library**, not per-deal generation.
One-time batch of ~60 destinations × 3–4 images (fal.ai / Gemini image gen; cents per
image), prompts style-locked to the Yip brand (apply the `yip-design-system` skill's
imagery-treatment rules when building). Stored once; admin picks at publish time.
Accuracy explicitly not required — evocative over literal ("Italy, somewhere near water").

Why not per-deal generation: latency, per-send cost, API-down failure mode, and style
drift across emails — for zero benefit. Sequencing: independent of everything else, but
only useful once a digest sender exists (Workstream B); the library batch can be run any
quiet afternoon before that.
