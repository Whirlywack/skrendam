# Engine tuning analysis — 2026-06-03

_Milestone 2, Workstream A4 ("tune + iterate"). Run against the Neon **dev** branch
(`ep-spring-rice-ag3lozh6`) via `skrendam analyze` + read-only score-distribution
queries. Founder decisions recorded inline._

## 1. The data (real dev DB)

```
candidates: 158 | matches: 246 | price points: 1846
discount % (p10/p50/p90): 17.0 / 34.7 / 47.9
match_score percentiles p25/p50/p75/p85/p90/p95: 0.801 / 0.85 / 0.905 / 0.955 / 0.983 / 1.0
match_score min/max: 0.59 / 1.0
```

A candidate can match several templates (246 matches / 158 candidates ≈ 1.56 each).
Discounts are genuinely strong — even the 10th percentile is 17% below baseline, the
median 34.7%. The gates (`SEND_THRESHOLD=0.55` + the strong-anomaly requirement) already
admit only real anomalies, so surviving `match_score`s pile up high (median **0.85**).

### Great/maybe split at trial cutoffs

| GREAT_THRESHOLD | great | maybe | % great |
|---|---|---|---|
| 0.80 (was) | 186 | 60 | **76%** |
| 0.85 | 125 | 121 | 51% |
| **0.88 (chosen)** | **88** | **158** | **36%** |
| 0.90 | 67 | 179 | 27% |
| 0.92 | 57 | 189 | 23% |

### Per-template profile

| template | trip | n | median score | %≥.85 | %≥.90 | min_disc | max_eur |
|---|---|---|---|---|---|---|---|
| Plan-ahead summer | rt | 88 | 0.865 | 62% | 32% | 30% | — |
| Last warm days | rt | 70 | 0.86 | 56% | 31% | 25% | 150 |
| **Family school-holiday sun** | rt | 66 | **0.767** | **24%** | 14% | **20%** | **400** |
| September sun, fewer crowds | rt | 12 | 0.865 | 58% | 17% | 25% | — |
| Christmas markets | rt | 5 | 0.961 | 60% | 60% | — | — |
| Last-minute long weekends | ow | 5 | 0.912 | 100% | 60% | — | psych 40 |

Zones (`threshold_price_eur` / `min_discount_pct` / `min_abs_savings_eur`) were already
sane and left unchanged: MEDITERRANEAN 60/25/30, CITY_BREAKS 45/25/20, CANARIES 222/30/50,
SCANDINAVIA 50/25/25, WESTERN_EUROPE 50/25/25, LONG_HAUL 350/30/150.

## 2. Decisions

### D1 — GREAT_THRESHOLD 80 → 88  _(code: `web/src/lib/tiers.ts`, `skrendam/analyze.py`)_
At 80, **76%** of matches were "great" — the tier carried no information. The median deal
scores 0.85, so a meaningful "great" must sit above the median. **88** makes "great" the
top ~36% (88 deals): enough to fill a feed/newsletter, selective enough that leading with
"great" means something. The median deal correctly falls to "maybe". `analyze.py`'s default
`great_threshold` was bumped to 0.88 to match (kept in sync via cross-reference comments;
a shared settings table is deferred — Spec §10, YAGNI).

### D2 — Tighten "Family school-holiday sun": 20%/€400 → 30%/€300  _(data: dev DB)_
The one mis-tuned template: high volume (66) but a low median score (0.767 vs ~0.86
everywhere else, only 24% ≥.85). It was the loosest — a 20% min-discount (others 25–30%)
up to €400 — so it flooded the queue with shallow school-holiday discounts. Raised to the
summer-flagship bar (**30% / €300**) to surface fewer, premium family deals and cut the
low-score tail. **Config is not retroactive** (Spec §6): the 66 existing matches persist
until the next scan re-evaluates them; the effect lands on the next `Run scan`.

### D3 — SEND_THRESHOLD kept at 0.55  _(no change)_
The minimum surviving `match_score` is 0.59, so nothing sits in 0.55–0.59; lowering the
floor would add nothing, and the "maybe" tier is already healthy (158 at the 0.88 bar).

## 3. Watch-items (not changed now)
- **Christmas markets** has no discount floor and no price ceiling. Quiet + high-quality in
  June (5 matches, median 0.961), but could flood in winter. Revisit when seasonal volume
  rises.
- Volume is summer/Mediterranean-skewed (MED 140/158) — expected for a June scan; not a
  tuning fault. Re-profile after a winter scan.
- The per-template/zone knobs live in the **dev** DB, not the repo. When a prod branch is
  provisioned, seed it with these tuned values (this doc is the record of intent).

## 4. Verification
- `skrendam analyze` post-change reports `tier preview: 88 great / 158 maybe`, matching the
  UI's `GREAT_THRESHOLD`.
- Family template readback confirmed `min_discount_pct=30.0, max_price_eur=300.0`.
