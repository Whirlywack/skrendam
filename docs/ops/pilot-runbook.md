# Pilot runbook — the 90-day plan, end to end

_Date: 2026-06-12. The operating companion to
`docs/research/2026-06-12-pilot-research.md` (strategy) and
`docs/handoffs/2026-06-12-pilot-rework-handoff.md` (build). This doc answers: who
does what, when, and how we know it's working. The coding agent builds workstreams
A–F; everything else here is **founder work** — no code ships it for you._

## 1. Traceability — every pilot commitment, accounted for

| Pilot commitment (research §6) | Where it lands | Status |
|---|---|---|
| Daily scan running | Founder: `install-daily-scan.sh` + kickstart | **in flight today** |
| Routes 14 → ~120–150, staggered cohorts | Workstream A | handoff ✓ |
| VFR-watch + long-haul templates | Workstream A | handoff ✓ |
| Marketability gate (≥5 departure dates) | Workstream A | handoff ✓ |
| Weekly digest email | Workstream B | handoff ✓ |
| Email open/click measurement | Workstream B (Resend webhooks/stats) | **added to handoff today** |
| Booking instructions + bookable dates in email | Workstream B template content | **added to handoff today** |
| LT-first site + emails, /en parallel | Workstream C | handoff ✓ |
| Evidence line ("usually €X", percentile) | Workstream D | handoff ✓ |
| "Book by ~X" fare half-life | Workstream D | handoff ✓ |
| Founding-member pre-sale page (€29 PFL, first 200) | Workstream E + founder Stripe setup (§4) | handoff ✓ / runbook |
| Money-back guarantee + price-for-life copy | Workstream E page copy | **added to handoff today** |
| TikTok content | **Founder screenshots deals/emails** — F dropped as build; optional share-image render later | re-scoped 2026-06-12 |
| TikTok account + 1 post/day | **Founder only** (§3) | runbook |
| Facebook page mirroring | **Founder only** (§3) | runbook |
| Telegram channel (RIX/LV experiment) | **Founder, optional** (§5) | runbook |
| Referral mechanics | v1 = forward-CTA in digest (B); full referral program **deliberately deferred** | decision §6 |
| Metrics + kill bars | Weekly scorecard (§7) — founder ritual, not a dashboard build | runbook |
| Destination watchlists | Deferred until prefs volume exists (subscriber `prefs` JSON is the hook) | deferred ✓ |
| Savings counters | Deferred — revisit when digest has ≥4 issues of data | deferred |
| Concierge / custom searches | Founder behavior at small scale, not a feature | deferred |
| WhatsApp (EE), LV/EE language editions, TLL routes | Out of pilot per founder decision #4 | excluded ✓ |
| Apps/push, agentic booking, price-prediction promises | Explicitly avoided (research §4) | excluded ✓ |

**Net assessment: the handoff was missing four small things (email metrics, digest
booking-instructions, guarantee copy, forward-CTA), all patched today. Everything
else in the pilot is either a workstream, a founder action below, or a deliberate
deferral.** Nothing in the workstreams is outside the pilot strategy.

## 2. The two clocks

The pilot runs on two independent clocks — don't let one block the other:
- **Build clock** (coding agent): A → B → C → D → E, F rides along. B is the
  hard gate for the funnel: captured emails get nothing until the digest ships.
  Target: B live before the TikTok account has its first 1,000 followers.
- **Audience clock** (founder): starts **now**, before any workstream merges. The
  June-3 queue already has publishable deals; TikTok day 1 doesn't need new code.

## 3. Founder cadence (weekly rhythm)

**Today / this week (Phase 0):**
1. Install + kickstart the daily scan (done today if the agent's run succeeded).
2. Curate the existing queue in the Deal Desk — 158 candidates, sweep-expires after
   the first scan past June 17. Publish the genuinely good ones; they're your first
   TikTok material.
3. Create the TikTok account (LT), Facebook page, and bio-link to `/subscribe`
   with `?src=tiktok` so `subscribers.source` attribution works from day one.
4. Stripe: create account, one payment link (€29/yr "Founding member"), decide VAT
   handling (likely MB/individual activity — confirm with your accountant). Needed
   by week ~6, not now, but the admin lead time is yours alone.

**Daily (~30–45 min):**
- Morning: Deal Desk. Red banner? Skip judgment on "no deals", carry on. No banner?
  Curate, publish 1–3.
- Record 1 TikTok from the best published deal (Workstream F gives you the script;
  until it ships, the `tiktok_hook` field + your voice is enough). Mirror to FB.

**Weekly (~1 hr):**
- Send/approve the digest (manual compose until B ships — even a hand-written email
  to the first 16 subscribers beats silence; it also pilots the template copy).
- Fill the scorecard (§7). If two consecutive weeks miss a kill bar, iterate the
  content format before touching the build order.

## 4. Pre-sale mechanics (weeks 6–12, Phase 2)

Trigger: engaged list (open ≥40%) AND ≥1,000 subscribers — don't launch the
pre-sale to a dead room. Offer: €29/yr **price for life**, first 200, 30-day
money-back, "early access + watchlists when they ship". Plain Stripe payment link
from §3.4; fulfillment = manual list membership (a `prefs.founding=true` flag) until
Spec 3. **Decision metric: ≥2% of engaged list pre-commits → build billing. <1% →
stay free, revisit positioning.**

## 5. Channels — scope discipline

LT is the pilot: TikTok + Facebook + email. The Telegram channel for RIX/LV deals is
a **zero-code optional experiment** (create channel, cross-post RIX deals weekly);
run it only if it costs you <15 min/week. WhatsApp/EE: not in this pilot. Resist
adding channels before the LT funnel produces a clean read — every extra channel
muddies attribution.

## 6. Decisions taken in this runbook (flag if you disagree)

1. **Referral program deferred** — pilot math assumed +20–35% from referrals, but a
   Morning-Brew-style system is real build. V1 = a "Forward this to a friend who
   flies" CTA + `?src=fwd` link in every digest (1 line in Workstream B). Build the
   real program only if organic growth stalls below the kill bar with good content.
2. **No metrics dashboard build** — the weekly scorecard is manual on purpose; the
   numbers come from 3 places you already have (TikTok analytics, Resend stats,
   one SQL query). Automate after the pilot proves anything at all.
3. **Manual digest before B ships** — pilots the copy AND respects the 16 real
   subscribers who signed up and have received nothing.

## 7. Weekly scorecard (copy per week into a note or sheet)

| Metric | Source | Bar | Kill bar |
|---|---|---|---|
| TikTok views (wk) | TikTok analytics | growing | — |
| Views → email subs | subs where source='tiktok' ÷ views | ≥0.1% | <0.05% after 2 format iterations |
| New subscribers (wk) | `SELECT count(*) FROM subscribers WHERE created_at > now()-interval '7 days'` | +10%/wk | flat 3 wks |
| Digest open rate | Resend | ≥40% | <25% |
| Deal CTR | Resend click data | ≥8% | <3% |
| Deals published (wk) | Deal Desk / published_deals | ≥5 | <3 (supply problem → check scan health, route expansion) |
| Scan health (wk) | scan_runs: healthy/degraded count | ≥5 healthy/7 | 3+ failed days (escalate: HTML fallback initiative) |
| Phase 2 only: pre-sale conversions | Stripe | ≥2% engaged list | <1% |

Kill bars mean **iterate or stop that bet** — they never mean "build more features."

## 8. What "ready for everything" means here

When someone (including future-you) asks "are we executing the new strategy?", the
answer is this file's §1 table: every line of the pilot plan maps to a workstream,
a founder action, or a named deferral with a revisit condition. If a new idea
doesn't fit one of those three buckets, it goes to
`docs/superpowers/out-of-scope.md` — not into the build order.
