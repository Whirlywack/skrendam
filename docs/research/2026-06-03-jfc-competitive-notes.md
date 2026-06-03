# Competitive notes — Jack's Flight Club → Spec 2 (Yip homepage) design inputs

_Date: 2026-06-03. Captured after milestone 2 (curator admin + engine tuning) shipped, as
**locked design inputs for the Spec 2 public site / homepage**. Source: founder research on
Jack's Flight Club (JFC)._

## Why this matters

JFC is the closest analogue to Yip: a **curated deal-alert service** — not a search engine,
not a booking platform. It **validates Skrendam's whole model** (automated scan + human
verification → publish; "we find them so you don't have to"; info/inspiration, user books
direct). The transferable lessons are all in the **delivery layer**, which is Spec 2 — not the
curator admin we just finished.

## JFC in one paragraph

Automated scanning flags fare anomalies (error fares, flash sales, inventory drops); human
"Navigators" verify before anything reaches members. Deals evaporate fast, so the product is
built around **speed + urgency management**: premium members get deals hours-to-a-day earlier,
push notifications fire the moment a deal lands, each alert states an **expected availability
window** ("act within 2h vs 2 days") plus step-by-step booking guidance, and every alert tells
you to **rebuild the fare in Google Flights yourself** before booking. Expired deals stay in
the archive. The free tier is deliberately *slowed* — notification speed is the premium good.

## Three locked design inputs for the Yip homepage (Spec 2)

### 1. A credible, data-driven "expected availability window"
JFC's core value is telling the user *how long they have*. Yip should do this — and do it
**better than gut feel**, because we already have the substrate:
- **Have already:** `published_deals.valid_until` + `published_deals.last_seen_at` (the field
  has a home); `price_log` — a real time-series (`scanned_at`, 1,846 points and growing); the
  `scan_requests` recheck path (the worker re-confirms live deals on demand).
- **The Yip edge:** *estimate* volatility/longevity from `price_log` history + recheck cadence
  rather than a blunt TTL or a curator guess. Surface a credible "act by ~X" / "still live —
  re-checked Nh ago" signal on the deal card.
- **Open questions for Spec 2:** how is `valid_until` set today (default vs curator vs
  estimate)? what recheck cadence keeps `last_seen_at` trustworthy without burning fli quota?
  how to show freshness honestly when a deal *might* already be gone (the verify-yourself CTA)?
  what's the estimator (simple: time-since-seen + historical fare half-life → later: a model)?

### 2. Tiered / segmented release (the access-timing layer)
"Premium gets it hours earlier" is a delivery-timing concept, not a new data shape.
- **Have already:** `tier` (great/maybe) on candidates + published deals; `audience_segments`;
  `newsletter_tag`; `publish_channel_default`.
- **Spec 2 needs:** the **access-timing logic** — who sees which deal, when. Likely a
  `publish_at`-per-tier / per-segment release schedule on a published deal (e.g. `premium_at`,
  `public_at`) rather than a single `published_at`.
- **Open questions:** segment → channel mapping; how "great" vs "maybe" interacts with
  free/premium; whether early access is per-deal or a global lead time.

### 3. Speed = the premium product (architecture spine, not a bolt-on)
JFC's monetization insight: people pay for *notification speed*. If Yip ever charges, this is
the spine — so Spec 2 must treat **release-timing + push** as first-class from day one.
- **Implication:** model a deal's publish as a **schedule across tiers/channels** (the
  `publish_at`-per-tier above), and design the homepage + notification path around "fastest
  access is the paid good." Even if v1 ships free-only, don't architect a single-audience
  instant publish that has to be torn up later.
- **Note:** this is a business-model + architecture decision to make *explicitly* in the
  Spec 2 brainstorm, not to assume.

## Noted, not lost (out of scope for now)
- **Error-fare detection** specifically (JFC's edge): our matching is anomaly-vs-baseline,
  which catches sales/drops but not necessarily true mistake pricing (that needs
  absolute-implausibility signals, not just % below median). A future **engine** refinement.
- Push infrastructure, accounts, billing — Spec 3+ (monetization), per the register §3.

## How to use this
These three are **inputs to the Spec 2 (Yip homepage) brainstorm** — start there; don't build
from this note directly. Inputs 1 + 2 likely imply the **first `published_deals` schema
additions since milestone 2** (a release schedule; possibly an availability-estimate field) —
design them deliberately (milestone 2 needed no migration; these would be the first).
