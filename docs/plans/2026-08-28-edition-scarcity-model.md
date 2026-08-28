# „Dienos numeris" — edition scarcity model (approved 2026-08-28)

Founder-approved model for what yip.lt shows vs. holds back. Design discussion in
session; research grounding: `docs/research/deal-detection-lit-brief.md` Q7/Q8
(gating preserves reference-price credibility; badge fatigue; deal mortality is
real but once-daily scans forbid precise deadlines) and
`docs/research/aifare deal detection.md` (deal-alert archetype = email-first).

## The model

The site is **today's edition, not an archive**. Visitor gets:

1. **Poster** — featured deal (newest live), full detail incl. booking link.
2. **„Dar spėji"** — the next **2** live deals, full rows. (Free window = 1+2.)
3. **Locked rows** — every further live deal renders redacted: destination +
   month visible, price masked, no booking link, subscribe CTA („Kaina — laiške").
4. **„Buvo. Nebėra."** — unchanged; expired deals show real prices as the
   credibility proof for what's locked.
5. Rotation is real: deals leave only via date sweep / curator expire (already
   built). No staged rotation, no invented deadlines — "gone" is provable,
   "gone at 17:00" is not.

## Decisions (founder, 08-28)

- **Free window: 1 + 2.** Poster plus two full rows; lock from the 4th live deal.
- **Control: automatic by rank** (newest N full, rest locked). Zero desk UI
  change. `published_deals.tier` stays in reserve for a future per-deal
  „Viešas / Tik laiške" Composer toggle — build only when a real deal needs it.

## Obligation

Locked rows sell the letter; **no letter has ever been sent**. First issue must
ship close behind this feature (Resend verify + first e2e signup are already on
the list). Interim copy points at signup without promising a dated letter.

## Sequencing

1. Desk session: publish today's deals (copy in LT) — no site change yet.
2. Mock locked-row + capped-index states **as screenshots with the real
   published deals** → founder sign-off (hard mockup rule).
3. Build after approval (site-only: cap constant + locked-row rendering in
   `LiveIndex` / `components/v2/Rows`).
4. First letter ships.
