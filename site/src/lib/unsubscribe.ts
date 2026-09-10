/** One-click unsubscribe link for a subscriber's `unsubscribe_token`.
 *
 *  EVERY marketing send (WP6 newsletter, early alerts — anything that is not a
 *  transactional confirm mail) MUST include this link, in the visible footer.
 *  It is the only way a subscriber can leave, the consent story on /privatumas
 *  depends on it, and bulk senders treat a missing unsubscribe as spam.
 *
 *  Unlike `siteUrl()` in `@/lib/seo`, the fallback here is the live domain, not
 *  localhost: this URL is read in someone's inbox, where a localhost link is a
 *  dead end. Read at call time so a send picks up the current environment.
 */
export function unsubscribeUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yip.lt').replace(/\/$/, '');
  return `${base}/atsisakyti?token=${encodeURIComponent(token)}`;
}
