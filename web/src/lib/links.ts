import { refCode } from './refcode';

/** Public site base for links that land in inboxes. The fallback is the live
 *  domain, not localhost (same reasoning as `site/src/lib/unsubscribe.ts`): a
 *  localhost link read in someone's mail client is a dead end. Read at call
 *  time so a send picks up the current environment. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://yip.lt').replace(/\/$/, '');
}

/** Unsubscribe link for a subscriber's `unsubscribe_token` — byte-identical to
 *  `site/src/lib/unsubscribe.ts`. EVERY outgoing mail ends with this link and
 *  sets it as the `List-Unsubscribe` header (see `email/client.ts`). */
export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/atsisakyti?token=${encodeURIComponent(token)}`;
}

function tracked(path: string, issueId: number | null, subscriberId: number): string {
  return `${siteUrl()}${path}?i=${issueId ?? ''}&s=${refCode(subscriberId)}`;
}

/** Click-tracked deal link: the site's `/go/<deal>` records a `deal_events`
 *  click (issue + subscriber via ref code) and redirects to the deal page.
 *  Every stream passes its `issues.id` — the instant stream inserts its row
 *  before rendering — so `null` only means a link built outside a send
 *  (the site parses an empty `i=` as no issue). */
export function trackedDealUrl(dealId: number, issueId: number | null, subscriberId: number): string {
  return tracked(`/go/${dealId}`, issueId, subscriberId);
}

/** „Užsisakiau" claim link — same query shape, lands on the site's claim page. */
export function claimUrl(dealId: number, issueId: number | null, subscriberId: number): string {
  return tracked(`/uzsisakiau/${dealId}`, issueId, subscriberId);
}

/** Payment link with the subscriber's ref code as `client_reference_id`, so the
 *  paid-plan webhook can attribute the purchase. Returns '' when no payment
 *  link is configured — renderers omit the upgrade block entirely then. */
export function upgradeUrl(subscriberId: number): string {
  const base = process.env.PAYMENT_LINK_URL;
  if (!base) return '';
  return `${base}?client_reference_id=${refCode(subscriberId)}`;
}
