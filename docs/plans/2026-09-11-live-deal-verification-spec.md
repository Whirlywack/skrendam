# Live-deal verification — spec (WP9, 2026-09-11)

Founder decision 2026-09-11: build it as one work package. Problem: published deals die only by
calendar or by hand; nothing automatic checks them, and a deal whose price moved (€93 → €124) keeps
being advertised at the old price. Recheck this morning: all three live deals were 33–99% above their
published price.

## 1. Model: a deal is a route + date window + "from €X", verified daily

Today `published_deals` is one itinerary. Keep that as the **sample itinerary** (booking link,
travel/return dates, flights) and add a **window view**: the template window the fare was found in
(`peak_windows`/template dates already on the candidate's match) and the best current price inside it.

## 2. States (`published_deals.status`)

| status | meaning | site shows |
|---|---|---|
| `live` | last check found the sample itinerary (or another date in the window) at ≤ published price × (1 + `PRICE_DRIFT_TOLERANCE_PCT`/100) | published price |
| `changed` (new) | still available and still clears the deal gate, but > tolerance above the published price | „Dabar nuo €124 · radome už €93" + updated sample dates |
| `expired` | see §4 | „Buvo. Nebėra." archive |

`unverified_since` stays as today: set on an empty answer, cleared on a real one. An empty answer never
changes `status` (BotGuard protection).

## 3. Checks (run inside the daily scan, right after the route pass; no worker)

Tier 0 — **window price from the calendar call (0 extra calls).** For every live/changed deal whose
route is in the day's scan set, read the calendar result for the deal's spec: the price on the
sample date and the minimum over the window. Routes with a live deal are **forced into the day's set**
even on their off-rotation day (+1 calendar call per such route).

Tier 1 — **exact-itinerary flights call** (`verification.recheck_candidate`) when any of:
- the calendar price on the sample date moved by more than the tolerance, or the date is gone;
- the deal is public (free window, `getFreeWindowIds`) — checked daily regardless;
- `verified_at` is older than `EXACT_CHECK_MAX_AGE_DAYS`.

Cap: `VERIFY_CALLS_PER_DAY = 30` flights calls, priority: public deals → deals mailed in the last 48 h
(`issues.deal_ids`) → newest `published_at`. Deals beyond the cap keep their state; the site shows
„patikrinta prieš N d." from `verified_at`.

Every check writes one row to `deal_price_checks(deal_id, checked_at, source ∈ calendar|flights,
available, price, window_min_price, window_min_date)` and updates `published_deals.current_price`,
`current_price_at`, `window_min_price`, `window_min_date`, `verified_at` (real answers only),
`missed_checks` (consecutive unavailable; reset on any real price).

## 4. Transitions (evaluated after the checks, pure function, tested)

- `live → changed`: available, `current_price > published × 1.10`, and still a deal:
  `discount vs baseline ≥ template min discount` and saving ≥ the zone's abs floor (reuse the template
  gates; `demand.py` constants for the archetype floors).
- `changed → live`: price back within tolerance.
- `* → expired`, automatic, real data only: (a) calendar (today's rule); (b) fails the deal gate on a
  **real** price; (c) `missed_checks ≥ MISSED_CHECKS_TO_EXPIRE = 2` (two consecutive days unavailable
  with the route otherwise answering — never on a degraded scan); (d) window: sample date gone but
  another window date qualifies → not expired, `changed` with new sample dates (the cheapest
  qualifying date; sample itinerary re-fetched by one flights call if within the cap).
- Curator expire/republish as today. Republish resets `missed_checks`.
- `expired_at` stamped on every path (done in #43 for the existing ones).

Constants (`skrendam/scanning/verification.py`): `PRICE_DRIFT_TOLERANCE_PCT = 10`,
`MISSED_CHECKS_TO_EXPIRE = 2`, `EXACT_CHECK_MAX_AGE_DAYS = 3`, `VERIFY_CALLS_PER_DAY = 30`.

## 5. Surfaces

- **Site** (`mappers.ts`): `changed` deals render the current price with „radome už €X" and
  `verifiedAt` visible („patikrinta prieš 3 val."); expired go to the archive with `lasted`.
  Reader signal: a „Kaina pasikeitė" button beside „Užsisakiau" (`deal_events.kind='price_changed'`).
- **Desk**: Live page shows state, current vs published, window min, missed checks, last check; Today's
  stale block goes away (replaced by „N deals changed today / M expired").
- **Letters**: instant mail = published price (sent once). Digest/nurture render `current_price` when set
  and the window „nuo €X". A `changed` deal is never re-sent as instant.
- **Stats (WP8)**: lifetime = `expired_at − published_at` already; add median lifetime per archetype
  to `/letters/stats` → later „tokie radiniai išbūna ~2 d." on the site (real numbers only).

## 6. Cost envelope
With ~15 live deals: ≤ 5 forced calendar calls + ~5–10 flights calls/day. With 100: ≤ 30 flights calls
(cap) + forced calendars, still inside ~900/day. One beat per day at 06:00; an optional evening beat
for public deals only (≤ 3 calls) is a later switch.

## 7. Borrowed patterns (credit)
Going (deal = window + sample dates + "from"), Airfarewatchdog (verified-ago stamp), Fly4free
(update-in-place notes), Secret Flying (reader reports). Not doing prediction/price-freeze.

## 8. Not in scope
No LLM, no new scan passes, no per-user watches, no change to scan cadence or zones.
