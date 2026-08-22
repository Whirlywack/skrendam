# Template drafts for review — VFR + winter sun

_Date: 2026-08-21. Thresholds grounded in `price_log` (dev Neon, 6,144 rows: 2026-06-03→13
daily + 2026-08-21). Companion to [2026-08-21-vno-route-refresh-personas.md](2026-08-21-vno-route-refresh-personas.md)._

## The data these drafts stand on

Round-trip EUR, per route (points / min / p10 / median / p90):

| Route | pts | min | p10 | median | p90 |
|---|---|---|---|---|---|
| VNO–STN | 69 | 72 | **79** | 196 | 818 |
| KUN–STN | 66 | 72 | **79** | 111 | 255 |
| VNO–AGP | 947 | 100 | 170 | 213 | 267 |
| KUN–AGP | 425 | 97 | 116 | 177 | 262 |
| VNO–LCA | 857 | 92 | 186 | 282 | 351 |
| VNO–BCN | 917 | 76 | 110 | 160 | 222 |
| RIX–BCN | 948 | 84 | 121 | 190 | 249 |
| RIX–TFS | 1038 | 332 | **407** | 524 | 791 |
| RIX–AYT | 513 | 198 | 293 | 399 | 494 |

**Caveats:** (1) this is *summer-scan* history — winter-fare distributions are unknown until
Nov+ history accrues; (2) OSL, DUB, LGW, LTN, DXB, TLV, MLA have **zero history** (not in
the current 14 routes); (3) all figures pre-date the BotGuard gate's effect on coverage.

## 1. VFR — adopt PR #8's `vfr-watch` as-is (now data-validated)

PR #8 already contains the full stack: `vfr` audience, `vfr_visit` moment (relative,
"Cheap weekend to visit family abroad"), and the `vfr-watch` template
(STN/LTN/LGW/DUB/OSL, RT, 3–14 days, ≤1 stop, +7→+90 days out,
`psychological_price_threshold_eur=80` with `allow_smaller_discount_if_under_price`,
`min_departure_dates=5`).

**Verdict: the €80 psych threshold is exactly the observed p10 on both London routes
(VNO-STN p10 €79, KUN-STN p10 €79, min €72).** An €80 alert fires on genuinely
bottom-decile fares — no tuning needed. Two notes:

- VNO-STN p90 is €818 (Christmas-period departures priced in June) — the corridor's
  seasonal spike is enormous, which is precisely why a *watch* product sells. No template
  change needed; the psych threshold handles it.
- The template references destinations with no scan history yet (LTN/LGW/DUB/OSL).
  Harmless — it simply won't fire for them until those routes are seeded and accrue
  baseline. Fires for STN from day one.

**Action when unfrozen:** merge with PR #8 unchanged. Nothing to redraft.

## 2. Winter sun — new (fills the Nov–Mar moment hole)

Nothing on main or PR #8 covers Nov 1–Mar 31. Draft, in `seeds.py` shape:

```python
# MOMENTS — add:
("winter_sun", "Winter sun", "seasonal", "Escape the dark months for real warmth"),

# templates — add:
dict(slug="winter-sun-escape", name="Winter sun escape",
     audience="flexible_adults", moment="winter_sun", trip_type="roundtrip",
     date_window_type="seasonal", season_start_mmdd="11-01", season_end_mmdd="03-31",
     included_zones=["MEDITERRANEAN", "CANARIES", "MIDDLE_EAST"],
     trip_len_min_days=4, trip_len_max_days=10,
     max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
     min_discount_pct=25,
     public_label="Winter sun", newsletter_tag="winter_sun",
     suggested_headline_template="{origin}->{destination} EUR{price} return - winter sun",
     content_angle="Escape the dark months for real warmth"),
```

Design decisions (all revisitable once winter history exists):

- **No `max_price_eur`, discount-gated only.** The sun destinations split into two price
  regimes — Med p10 ≈ €120–190 vs Canaries p10 ≈ €407 — so any single absolute cap either
  strangles Canaries deals or waves through mediocre Med fares. `min_discount_pct=25`
  self-calibrates against each route's own baseline, which is the only data-honest gate
  while winter distributions are unknown. Revisit after ~Dec 1: likely split into
  `winter-sun-med` (cap ~€180) + `winter-sun-far` (Canaries/DXB, cap ~€450).
- **Season 11-01→03-31 wraparound is supported** (`resolver.py:22` handles Dec→Feb; the
  known 02-29 crash, deferred finding §6.3, is avoided).
- **Audience: reuse `flexible_adults`** — no new audience row; "winter-sun escaper" is a
  content angle, not a distinct itinerary-tolerance profile.
- **MIDDLE_EAST zone** brings in DXB (two carriers from Oct → fare-war candidate) and TLV.
  On main today the zone/routes don't exist yet, so pre-#8 the template fires only for
  MEDITERRANEAN/CANARIES routes in the current 14 (AGP×2, LCA, TFS, BCN×2, AYT) — correct
  and useful immediately.
- **`min_departure_dates` omitted** — the column ships with PR #8's migration 0008; add
  (=5) when #8 merges. Everything else in the draft works on main's schema today.

## 3. Ski — new (founder-requested 2026-08-21)

No history exists on any ski route (none seeded), so like winter-sun this is
discount-gated, not price-capped. Destinations via `included_destinations` (column exists
on main) rather than a new ALPS zone — zone row deferred until the destination set proves
stable.

```python
# MOMENTS — add:
("ski_season", "Ski season", "seasonal", "The Alps at a Baltic-friendly price"),

# templates — add:
dict(slug="ski-alps", name="Ski trip to the Alps",
     audience="flexible_adults", moment="ski_season", trip_type="roundtrip",
     date_window_type="seasonal", season_start_mmdd="12-01", season_end_mmdd="03-31",
     included_destinations=["GVA", "GNB", "TRN", "SZG", "ZRH", "MUC"],
     trip_len_min_days=3, trip_len_max_days=8,
     max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
     min_discount_pct=25,
     public_label="Ski season", newsletter_tag="ski",
     suggested_headline_template="{origin}->{destination} EUR{price} return - ski the Alps",
     content_angle="The Alps at a Baltic-friendly price"),
```

Notes:

- **Destination set:** GVA + GNB (dedicated winter ski routes from VNO), TRN (year-round,
  VNO), SZG (TLL — Salzburg), ZRH + MUC (year-round gateways from VNO and TLL). None of
  these routes are seeded on main, so the template is inert until the PR #8 route refresh
  lands — safe to seed early, fires when routes exist.
- **Season 12-01→03-31** (wraparound supported; avoids the known 02-29 crash). Easter-week
  April skiing deliberately excluded — add only if readers ask.
- **Ski-specific caveat for deal copy** (not engine): fares exclude ski-equipment bag fees
  (€40–60 each way on LCCs) — the newsletter blurb should say so, or the "deal" reads as
  bait-and-switch to anyone bringing gear.
