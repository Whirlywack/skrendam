# Handoff — 2026-09-11: WP6 email streams — code-complete, first send is yours

**Branch:** `feat/wp6-email-streams` (worktree `.claude/worktrees/wp6-email`).
**Plan:** `docs/plans/2026-09-10-wp6-email-streams-plan.md` (8 tasks). **Spec:**
`docs/plans/2026-09-10-demand-layer-launch-spec.md` §4 WP6, §5–§9.
**Canonical context updated:** `docs/PROJECT.md` §3 "Email streams", §6, §7.

Nothing sends until `RESEND_API_KEY` is in `web/.env.local`. Every send path
returns early without it and still records its `issues` row with
`stats.skipped_no_key = true`, so the desk keeps publishing exactly as before.

## What shipped

| Piece | Where | Notes |
|---|---|---|
| Migration `0014_email_streams` | `alembic/versions/0014_email_streams.py` | `subscribers.plan/paid_since/paid_source`, `published_deals.expired_at` (backfilled for already-expired rows), `issues`, `deal_events`. Applied to Neon dev; drizzle schemas re-pulled in both apps. |
| Sender foundation | `web/src/lib/email/client.ts`, `web/src/lib/subscribers.ts`, `web/src/lib/links.ts` | `emailEnabled()`, `sendMail()` (never throws, sets `List-Unsubscribe`), `activeSubscribers(plan)` — the ONLY recipient source, tracked `/go` + `/uzsisakiau` links, `upgradeUrl()`. |
| LT renderers | `web/src/lib/email/render.ts`, `copy.ts`, `format-lt.ts`, `cities-lt.json` | instant / digest / nurture, HTML + text twin, spec §7 copy verbatim, banned words tested, „įprastai" only at ≥30% drop. |
| Instant paid stream | `web/src/lib/email/streams.ts`, `web/src/app/actions.ts::publishDeal` | Fires on publish to `plan='paid'` subscribers who want the deal's origin; failures counted, never fail the publish. `expireDeal` stamps `expired_at`, `republishDeal` clears it. |
| Letters page | `web/src/app/(app)/letters/`, `web/src/app/letters-actions.ts`, `web/src/lib/letters*.ts` | Assemble paid digest / free nurture → `issues` row → preview (iframe) → Send (confirm on second click). Cadence constants `FREE_LETTER_CADENCE_DAYS=10`, `FREE_LETTER_FRESH=2`, `FREE_LETTER_MISSED=3`, `DIGEST_DAY='Thursday'`, `DIGEST_TIME='07:00'` are labels only. |
| Subscribers page | `web/src/app/(app)/subscribers/`, `web/src/app/subscribers-actions.ts` | Newest first with signup prefs, referral counts, manual `plan` flip (`setPlan`). |
| Site tracking | `site/src/app/go/[dealId]/route.ts`, `site/src/app/uzsisakiau/[dealId]/`, `site/src/lib/events.ts` | `/go/<deal>?i=&s=` → `click` + 302; `/uzsisakiau/<deal>` POST → one `booked_claim` per subscriber per deal. 60/min/IP limiter; robots disallow. |
| Founding-interest one-off | `scripts/2026-09-12_founding_interest_backfill.sql` | Written, NOT run. See step 6 below. |

**Pending elsewhere:** PR #39 (open, not yet merged) gates `tests/search`
behind `--live`. This branch has no such gate — until #39 merges, never run
whole-repo `pytest` from the scan laptop (`uv run pytest tests/skrendam` only).

**There is no scheduler (decision D1 — no always-on host).** Thursday 07:00
is a calendar habit: open `/letters`, Assemble, read the preview, Send.

## First-send checklist (founder)

Do these in order. Nothing below is automated.

### 1. Resend: verify `yip.lt` as a sending domain

1. Resend dashboard → Domains → Add `yip.lt` (region EU).
2. Add the DNS records Resend shows at iv.lt (same panel as the DNSSEC fix):
   - **SPF** — TXT on the `send` subdomain Resend names (typically
     `send.yip.lt`): `v=spf1 include:amazonses.com ~all`.
   - **DKIM** — the TXT record(s) `resend._domainkey.yip.lt` (value from the
     dashboard, copy verbatim — it is long).
   - **MX** on the same `send` subdomain (`feedback-smtp.eu-west-1.amazonses.com`,
     priority 10) so bounces come back.
   - **DMARC** — TXT `_dmarc.yip.lt`: `v=DMARC1; p=none; rua=mailto:<your inbox>`
     (start with `p=none`; move to `quarantine` after a few clean weeks).
3. Wait for Resend to show **Verified** (DNS can take up to an hour at iv.lt).
   Do not send from an unverified domain — Gmail will junk it and the
   reputation cost is real.
4. Create an API key (Sending access only, restricted to `yip.lt`).

### 2. Keys into `web/.env.local` (the desk on the laptop)

```
RESEND_API_KEY=re_…                # from step 1.4 — unset = nothing sends
YIP_FROM_EMAIL=Yip <hello@yip.lt>  # the sender shown in inboxes
NEXT_PUBLIC_SITE_URL=https://yip.lt  # base for /go, /uzsisakiau, /atsisakyti links in mail
PAYMENT_LINK_URL=                  # step 3; leave empty until then (no upgrade block)
```

Empty values count as unset (fallbacks: `Yip <hello@yip.lt>`, `https://yip.lt`,
no upgrade block). `site/.env.local` on Vercel already has its own
`RESEND_API_KEY`/`YIP_FROM_EMAIL` for the confirm mails — keep them the same
sender. Restart `npm run dev` in `web/` after editing.

### 3. Stripe Payment Link (paid plan)

1. Stripe → Payment Links → New → the paid subscription product (recurring).
2. Under "After payment" send people to `https://yip.lt/?paid=1` (or the
   thank-you page you prefer — there is no `/paid` route yet).
3. Copy the link URL into `PAYMENT_LINK_URL`. The desk appends
   `?client_reference_id=<refCode>` so the payer is identifiable later.
4. **No webhook in this phase.** When a payment lands (Stripe email), open
   `/subscribers`, find the row by email, flip **free → paid**. That sets
   `paid_since=now`, `paid_source='manual'`, `early_alerts=true`. Flip back to
   free on cancellation. The instant stream and the Thursday digest go to
   paid rows only; the nurture to free rows only.

### 4. Test sends — Gmail, Apple Mail, Outlook

Before any real subscriber gets a mail:

1. Add three test rows on the site (signup + confirm click) using a Gmail
   address, an iCloud/Apple Mail address and an Outlook.com address. On
   `/subscribers` flip one of them to **paid**.
2. **Instant:** publish any candidate from Review. The paid test address
   should get „{price} € — {Miestas}" within a minute. Check: sender name,
   subject, the LT dates, the CTA opens the booking page via `/go`, the
   „Užsisakiau" link lands on `/uzsisakiau/<id>` and the button records a
   claim (`SELECT * FROM deal_events ORDER BY id DESC LIMIT 5` in Neon).
3. **Digest:** `/letters` → Assemble paid digest → preview → Send. Check the
   family/moment block ordering against the test row's prefs.
4. **Nurture:** flip the test row back to free → Assemble free nurture →
   Send. Check „Ką praleidai" shows real expired deals with „išbuvo … val./d."
   and that the upgrade block appears only once `PAYMENT_LINK_URL` is set.
5. In each client: not in spam; images none (text-only design, so nothing to
   block); the unsubscribe footer link works and the client shows its own
   "Unsubscribe" affordance from the `List-Unsubscribe` header; dark mode
   readable (Apple Mail inverts backgrounds — the `#FFFDF7` / `#1C1813` pair
   should survive).
6. Verify each `issues` row has `sent_at` and `stats` (`sent`, `failed`,
   `skipped_no_token`, `skipped_origin`). Delete the test subscribers
   afterwards, or leave them and flip to free — your call.

### 5. First real Thursday

Calendar reminder, Thursday 06:45: `/letters` → Assemble paid digest → read
every card (headline, catch, dates) → Send. Then Assemble free nurture on the
10-day rhythm from the same page. The instant stream needs nothing from you —
it fires on every publish while the key is set.

### 6. Run the founding-interest one-off (once)

`scripts/2026-09-12_founding_interest_backfill.sql` marks every pre-existing
early-alerts opt-in with `prefs.founding_interest = true`. The Subscribers
page shows the flag; it is captured for the first upgrade ask, which is manual
for now — nothing in the nurture renderer reads it. Postgres only (jsonb), idempotent,
wrapped in a transaction. Run it against Neon **dev** (the active branch)
after 0014 is applied — via the Neon SQL editor or
`psql "$DATABASE_URL_UNPOOLED" -f scripts/2026-09-12_founding_interest_backfill.sql`.
The verify query at the bottom of the file prints the count.

### 7. Later (not blocking the first send)

- **RFC 8058 one-click unsubscribe:** add `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
  next to the existing `List-Unsubscribe` header in `web/src/lib/email/client.ts`
  and accept a POST on `/atsisakyti` that unsubscribes without the confirm
  page. Gmail/Yahoo require it for bulk senders (5k+/day); we are far below,
  but it is the next deliverability item.
- Stripe webhook → automatic `plan` flip (replaces the manual toggle).
- Move `DMARC` from `p=none` to `p=quarantine` once reports are clean.

## What WP8 (metrics) reads from `deal_events`

`deal_events` is the only behavioural table; every row is one of:

| `kind` | Written by | `issue_id` | `subscriber_id` | `source` |
|---|---|---|---|---|
| `click` | `site/go/<deal>` GET (one per hit; mail-scanner prefetches count — accepted noise) | the letter's `issues.id`, or NULL from the instant stream / a bare link | from `s=` ref code when valid, else NULL | `'email'` when `i` was present, else NULL |
| `booked_claim` | `/uzsisakiau/<deal>` POST button | same | same — **one per (deal, subscriber)**; anonymous claims every time | same |

Joins: `deal_id → published_deals.id` (any status — expired deals still
redirect), `issue_id → issues.id` (`kind` in `instant` / `paid_digest` /
`free_nurture`, `deal_ids` json, `sent_at`, `stats`), `subscriber_id →
subscribers.id` (**ON DELETE SET NULL** — a deleted subscriber's events
survive anonymised). Per-deal "how many booked" for the nurture is already
`count(*) where kind='booked_claim' group by deal_id` (`bookedEvents` in
`web/src/lib/letters-queries.ts`, folded to `bookedCount` per deal in
`web/src/lib/letters.ts`). Click-through per issue = clicks with that
`issue_id` ÷ `issues.stats.sent`. Nothing is estimated anywhere; if a number
is not in this table, the product does not show it.

## Gates run at handoff

- `uv run pytest tests/skrendam -q` — green (incl. the `cities-lt.json` drift
  guard added in this task: canonical `skrendam/cities-lt.json`, copies in
  `site/src/lib/` and `web/src/lib/email/`).
- `cd site && npx tsc --noEmit && npx vitest run` — green.
- `cd web && npx vitest run src/lib/email/client.test.ts` — green (full
  `web` tsc/vitest were mid-edit by Tasks 4/5 at handoff time; the controller
  runs them once the branch settles).
