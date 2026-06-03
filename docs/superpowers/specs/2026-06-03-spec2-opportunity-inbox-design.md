# Spec — Yip public site v1: the "opportunity inbox" (Spec 2)

_Date: 2026-06-03. Builds on the merged deal engine (`skrendam/`) + curator admin (`web/`). Approved via brainstorming on 2026-06-03 (visual companion). Inputs: `docs/research/2026-06-03-jfc-competitive-notes.md` (JFC lessons) + the three locked Spec 2 design inputs._

## 1. Summary

The public Yip homepage — a **decision-support "opportunity inbox"**, not a search engine. v1's job is to **prove the copilot**: lead with deals that *tell you what to do and why*, reduce booking anxiety, and convert visitors into a following. It is a **separate Next.js app** that reads the engine's published deals **read-only**; it never writes engine data and never calls `fli`/the engine directly.

The experience is two-tier: a **calm browse feed** you scan → **See the deal** → a **decision/detail page** where you decide and book direct. Every claim on those pages is grounded in data the engine already produces (`price_log`, the itinerary gates, the recheck path), so the copilot is honest, not hype.

## 2. Locked decisions (the anchors)

- **v1 anchor: prove the copilot.** Decision-support leads; email capture rides alongside (secondary, present, not shouting).
- **Two card tiers:** a light **browse card** (homepage feed) and a full **decision card / detail page** (decide + book).
- **"Going fast" = hard observed signals only.** Shown only when a recheck actually saw the price rise or the fare vanish on some dates. Never speculative — JFC's #1 user complaint is false urgency.
- **Confidence scoring stays internal** — never shown publicly. Public quality is a qualitative label (Rare / Great).
- **Separate public app**, reads `published_deals` (+ `price_log`) read-only. Optimised for SEO / caching / scale / no-auth, independently of the auth-walled admin.
- **No accounts in v1.** The "Watch" tab, personalised ranking, push, and tiered/early-access release are **Spec 3**. v1 is a single public audience.
- **Booking is direct** (airline / OTA / Google fallback); Yip is the scout, not the seller.

## 3. Surfaces (UX)

Brand per the `yip-design-system` skill: amber primary, sea-teal trust, coral for genuine urgency only; Bricolage (display/price), Hanken (body), Space Mono (metadata/eyebrows); sentence case; numbers are the hero; show the value **and the catch**. Mockups explored in the brainstorm live under `.superpowers/brainstorm/.../content/` (homepage-v1, cards-two-tier, deal-detail-v2).

### 3.1 Homepage — the opportunity inbox
- **Header:** `yıp` wordmark · "From VNO · KUN · RIX" (airport context) · quiet "Get deals by email" link.
- **Hero:** eyebrow ("Found & checked by hand · N new today") + H1 ("This week's best fares from the Baltics.") + the honest one-liner ("We find the cheap ones, check they're real, tell you why and the catch. You book direct.").
- **Tabs:** **Book now (N)** · **Inspiration**. (No "Watch" — Spec 3.)
- **Feed:** responsive grid of **browse cards**.
- **Capture band:** calm dark band after the feed ("Never miss a rare fare." + email + amber "Get deals"). Secondary.

### 3.2 Browse card (the scannable atom)
Lighter shadow, destination-led. Top→bottom: **quality tag** · **destination** (Bricolage) · route+dates (mono) · **price** (hero) · reduced proof ("36% below typical") · **catch** line ("Catch: 3h Riga layover") · **status line** · outline **"See the deal →"** CTA. No confidence %. Text-only in v1 (subtle destination photos are an optional later enhancement).

### 3.3 Deal detail page (decide + book) — the approved template
Two columns:
- **Left — decide:** quality chip · verdict ("Book this — it rarely drops this low.") · **price** · route+dates · why ("−36% vs the 90-day median (€150)") · short **catch** ("Catch: 3h Riga layover") · **booking CTA** (see §3.5) · provider-accurate sub-line · **"Checked Nh ago"**.
- **Right — proof:**
  - **Why it's a good deal** — bold claim ("Cheapest 8% we've seen in 90 days.") + **price-history sparkline** (today marked amber, tagged **"Today €96"**) + range row (best / typical / highest).
  - **Your itinerary** — the real legs with times, a **coral "the catch"** flag (explained plainly), and a **sea "all-clear"** flag (no self-transfer / no airport change / bag included).
  - **Good to know** — two lines: "We checked this fare N hours ago and recheck before you book. Deals like this usually last a day or two, not weeks." + a quiet verify link **"Want to be sure? Check it in Google Flights →"**.
- **Back link:** "← All deals".

### 3.4 Triage language (consistent across surfaces)
- **Quality tag** = how good: **amber "Rare deal"** (top band) / **sea "Great deal"** (solid). Derived from `match_score` bands (see §4); both live in **Book now**.
- **Status line** = freshness or urgency: **"Checked Nh ago"** (calm, default) or **coral "Going fast"** (observed-signal only).

### 3.5 Booking CTA copy rule (provider-accurate — never a mismatch)
| Path | Button | Sub-line |
|---|---|---|
| Airline-direct | **Book with <airline>** | Airline-direct · live price shown there |
| OTA | **Open booking partner** | Live price shown before you pay |
| Google fallback | **Open in Google Flights** | Use this to check live availability |

The airline/provider named in the CTA **must match the itinerary**. Source the booking target + vendor from the engine's booking options.

## 4. The availability engine (what makes every claim honest)

All grounded in existing data; **confidence remains internal**.

- **Comparison ("cheapest X% in 90 days", range, sparkline):** computed **read-time from `price_log`** (read-only) for that route+trip over a 90-day window — today's percentile, min/median/max, the series for the sparkline. Gated on `sample_size`: if history is thin, drop the bold claim and show only the discount-vs-median line.
- **Quality tag bands:** `Rare deal` = `match_score` ≥ **0.94** (top band); `Great deal` = great tier (≥ 0.88). `maybe` tier (< 0.88) → **Inspiration** tab. Bands are tunable via the existing `skrendam analyze` tooling, like `GREAT_THRESHOLD`.
- **Freshness ("Checked Nh ago"):** from `published_deals.last_seen_at`. **Recheck cadence:** the worker re-verifies live published deals every few hours **and immediately before a booking handoff**; cadence tunable against fli quota.
- **"Deals usually last a day or two":** from how long past deals at this discount stayed live (candidate lifecycle). Generic-but-true copy in v1; per-deal as history grows.
- **"Going fast" (coral):** set **only on a hard observed signal** — a recheck saw the price rise, or the fare vanished on some dates. A worker-set boolean; never a prediction.
- **Status:** Live (fresh) → Going fast (observed) → **Gone** (recheck shows it's gone → the deal expires and leaves "Book now").

## 5. Architecture & data flow

- **New separate Next.js app** (working name `site/`), own deploy, SSR/ISR for SEO + CDN caching. Reads Neon **read-only**: `published_deals` (the feed + detail) and `price_log` (the comparison/sparkline). It **never writes engine data and never calls `fli`/the engine.**
- **Shared design system:** reuse `yip-design-system` tokens + the website UI kit (`ui_kits/website`) as the starting point; share `colors_and_type.css`.
- **Read path:** a thin data layer (Drizzle introspection, same pattern as the admin) → typed view models → server components. Caching/ISR for the feed; revalidate on a short interval (deals change with scans/rechecks).
- **The admin is unchanged.** Both apps read the same DB; only the engine/worker writes.

## 6. Data-model impact (the first additions since milestone 2 — deliberate)

Alembic owns the schema (both apps read it; the public app writes nothing to engine tables). Minimise additions:
- **`published_deals.going_fast` (bool, worker-set)** — the observed-urgency flag. (Likely the only new engine column; reuse existing `valid_until`, `last_seen_at`, `tier`, `status`.)
- Comparison numbers are **computed read-time from `price_log`** — no new columns.
- A migration adds `going_fast`; the worker sets it on the observed signal during recheck.

## 7. Email capture (R0)

Secondary but present. **Default: post captures to a newsletter provider** (e.g. Buttondown) via API from the public app — keeps the public app's engine-DB access read-only, and the list lives where the eventual newsletter send will happen. **Alternative** (if we prefer owning the list in our DB): a `subscribers` table (Alembic) the public app inserts into — a narrow, public-owned write. Decide at plan time. The **newsletter send mechanism itself is out of scope for v1** (capture now; send later).

## 8. Non-functional

- **SEO:** SSR + per-deal metadata/OG tags (deals should be shareable/findable) — a core reason for the separate app.
- **Performance:** the homepage is the growth surface; fast LCP, cached feed, lightweight cards.
- **Accessibility:** semantic structure, contrast (warm palette already AA-minded), keyboard/focus.
- **Honesty invariants:** never show a stale price as live (freshness + recheck-before-handoff); never show "Going fast" without an observed signal; CTA provider always matches the itinerary.

## 9. Dependencies & risks

- **Recheck reliability + worker atomicity** (out-of-scope §5): the freshness/"Going fast"/Gone signals depend on the recheck path — revisit the worker's single-worker atomicity + add the recheck E2E **as part of** this backend work, not after.
- **R1 affiliate-ready links:** build the booking handoff so affiliate routing (Travelpayouts) can slot in later without a redesign — flag, don't implement now.
- **price_log volume:** the comparison needs enough history per route; the `sample_size` gate handles the thin-history case gracefully.

## 10. Out of scope (deferred)

- Accounts, the **Watch** tab, personalised ranking, personal price memory — **Spec 3**.
- Push notifications, quiet-mode batching — Spec 3.
- **Tiered / early-access release** (`publish_at` per tier) — Spec 3 (needs the Pro audience).
- Destination **photos** on cards (optional polish), affiliate **routing** (monetization), the newsletter **send** mechanism, loyalty/points, group planning, predictive matching — later (`docs/superpowers/out-of-scope.md`).

## 11. Build sequence (the plan will detail)

1. Scaffold the separate Next.js app + Yip tokens + read-only Drizzle on `published_deals`/`price_log`.
2. Browse card + homepage feed (Book now / Inspiration tabs) + the triage language.
3. Deal detail page template (the two-column decide/proof layout + CTA copy rule).
4. The availability layer — read-time comparison from `price_log`; freshness from `last_seen_at`; the `going_fast` migration + worker signal; quality-tag bands.
5. Email capture (provider integration or `subscribers` table — decided at plan time).
6. SEO/metadata, caching/ISR, accessibility pass.
