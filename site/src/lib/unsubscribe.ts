/** Unsubscribe link for a subscriber's `unsubscribe_token`.
 *
 *  EVERY marketing send (WP6 newsletter, early alerts — anything that is not a
 *  transactional confirm mail) MUST include this link, in the visible footer.
 *  It is the only way a subscriber can leave, the consent story on /privatumas
 *  depends on it, and bulk senders treat a missing unsubscribe as spam.
 *
 *  The link lands on a confirm page (`/atsisakyti?token=…`, GET is read-only)
 *  with one button whose POST does the unsubscribe: mail scanners fetch every
 *  URL in an incoming mail, and a state-changing GET let them unsubscribe
 *  people who never clicked. One-click for mail clients is an RFC 8058
 *  `List-Unsubscribe-Post` header — a WP6 concern, not this link.
 *
 *  Unlike `siteUrl()` in `@/lib/seo`, the fallback here is the live domain, not
 *  localhost: this URL is read in someone's inbox, where a localhost link is a
 *  dead end. Read at call time so a send picks up the current environment.
 */
export function unsubscribeUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yip.lt').replace(/\/$/, '');
  return `${base}/atsisakyti?token=${encodeURIComponent(token)}`;
}

/** Shape check shared by the /atsisakyti page (GET) and its action (POST), so
 *  a junk token is refused the same way on both — and before any DB round trip.
 *  Real tokens are 32 hex chars (`randomBytes(16)` here, `token_hex(16)` in the
 *  backfill); anything shorter than 16 cannot be one. */
export function isUnsubscribeToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 16;
}
