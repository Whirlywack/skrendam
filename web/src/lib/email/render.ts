import type { publishedDeals } from '../../db/generated/schema';
import { eur, WAS_PRICE_MIN_DROP_PCT } from '../format';
import { claimUrl, trackedDealUrl, unsubscribeUrl, upgradeUrl } from '../links';
import personas from '../personas.json';
import { momentCodes, type Recipient } from '../subscribers';
import { L } from './copy';
import { formatDatesLt, ltCity } from './format-lt';

/** A `published_deals` row as drizzle selects it. `price`, `baselinePrice` and
 *  `discountPct` are typed as numbers but can arrive as numeric strings from
 *  the driver — always read them through `num()`. */
export type Deal = typeof publishedDeals.$inferSelect;

/** An expired deal for the nurture's „Ką praleidai" block. Both extras are
 *  facts the caller computed — `lastedHours` from `published_at → expired_at`,
 *  `bookedCount` from `deal_events` — never estimated here. */
export type MissedDeal = Deal & { lastedHours: number; bookedCount: number };

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const PERSONAS = personas as Record<string, string[]>;

// ---------------------------------------------------------------------------
// Helpers

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Escape for HTML text and attribute values. Curator copy is trusted in
 *  spirit but escaped anyway — a stray `<b>` must never become markup. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Body text: escape, then newline → `<br>`. No other markup. */
function bodyHtml(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, '<br>');
}

/** „Vilnius → Londonas" — LT nominative city names, English fallback. */
function route(deal: Deal): string {
  return `${ltCity(deal.origin).nom} → ${ltCity(deal.destination).nom}`;
}

/** „gruod. 22–28" — LT month abbreviations, month first; '' without a date. */
function dates(deal: Deal): string {
  return deal.travelDate ? formatDatesLt(deal.travelDate, deal.returnDate) : '';
}

/** „įprastai X €" only on deep deals — the was-price gate shared with the
 *  site and the engine (`WAS_PRICE_MIN_DROP_PCT`). */
function usually(deal: Deal): string | null {
  const baseline = num(deal.baselinePrice);
  const drop = num(deal.discountPct);
  if (baseline == null || drop == null || drop < WAS_PRICE_MIN_DROP_PCT) return null;
  return L.usually(baseline);
}

// ---------------------------------------------------------------------------
// Style — mirrors site/src/lib/email.ts (inline, 520px, cream/ink/amber).

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const S = {
  body: `margin:0;padding:0;background:#FFFDF7;font-family:${FONT};`,
  wrap: 'max-width:520px;margin:0 auto;padding:48px 24px;',
  wordmark: 'margin:0 0 32px;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#1C1813;',
  section: 'margin:32px 0 12px;font-size:14px;font-weight:600;color:#6B6560;',
  card: 'margin:0 0 28px;padding:0 0 28px;border-bottom:1px solid #E8E3D9;',
  headline: 'margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:700;color:#1C1813;',
  meta: 'margin:0 0 12px;font-size:14px;line-height:1.5;color:#6B6560;',
  price: 'margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:700;color:#1C1813;',
  was: 'font-size:14px;font-weight:400;color:#6B6560;',
  text: 'margin:0 0 20px;font-size:16px;line-height:1.6;color:#1C1813;',
  cta: 'display:inline-block;background:#E2820E;color:#FFFDF7;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;letter-spacing:0.01em;',
  claim: 'margin:16px 0 0;font-size:13px;line-height:1.5;color:#6B6560;',
  link: 'color:#6B6560;text-decoration:underline;',
  upgradeLink: 'color:#E2820E;font-weight:600;text-decoration:underline;',
  footer: 'margin:32px 0 0;font-size:13px;color:#6B6560;line-height:1.5;',
} as const;

function heading(label: string): { html: string; text: string } {
  return {
    html: `<p style="${S.section}">${escapeHtml(label)}</p>\n`,
    text: `${label}\n\n`,
  };
}

function shell(r: Recipient, inner: { html: string; text: string }): { html: string; text: string } {
  const unsub = unsubscribeUrl(r.unsubscribeToken ?? '');
  const html = `<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${S.body}">
  <div style="${S.wrap}">
    <p style="${S.wordmark}">yıp</p>
${inner.html}    <p style="${S.footer}"><a href="${escapeHtml(unsub)}" style="${S.link}">${escapeHtml(L.unsub)}</a></p>
  </div>
</body>
</html>`;
  const text = `yıp\n\n${inner.text}${L.unsub}: ${unsub}\n`;
  return { html, text };
}

// ---------------------------------------------------------------------------
// Cards

/** The price a `changed` deal is really at now: `current_price` (the exact
 *  itinerary, re-priced), else `window_min_price` (the itinerary is gone, a
 *  cheaper date in the window is not). Null for any other state, or when
 *  the scan recorded neither — then the card falls back to the published
 *  price like a live one. */
function currentPriceOf(deal: Deal): number | null {
  if (deal.status !== 'changed') return null;
  return num(deal.currentPrice) ?? num(deal.windowMinPrice);
}

/** One live deal: headline, route + dates, price (+ „įprastai" when the drop
 *  clears the gate), body as-is, CTA to the tracked deal link, „Užsisakiau"
 *  claim link. Both twins carry the same two URLs.
 *
 *  A `changed` deal (digest/nurture only — instant mail is sent from
 *  `publishDeal` with the fresh row) leads with the current price: „nuo
 *  124 €" and „radome už 93 €" in place of „įprastai" — the published price
 *  is the honest reference now, not the baseline. */
export function dealCard(deal: Deal, r: Recipient, issueId: number | null): { html: string; text: string } {
  const published = num(deal.price) ?? 0;
  const current = currentPriceOf(deal);
  const price = current == null ? eur(published) : L.from(current);
  const was = current == null ? usually(deal) : L.foundAt(published);
  const go = trackedDealUrl(deal.id, issueId, r.id);
  const claim = claimUrl(deal.id, issueId, r.id);
  const meta = [route(deal), dates(deal)].filter(Boolean).join(' · ');

  const html =
    `    <div style="${S.card}">\n` +
    `      <p style="${S.headline}">${escapeHtml(deal.headline)}</p>\n` +
    `      <p style="${S.meta}">${escapeHtml(meta)}</p>\n` +
    `      <p style="${S.price}">${escapeHtml(price)}${was ? ` <span style="${S.was}">${escapeHtml(was)}</span>` : ''}</p>\n` +
    (deal.body ? `      <p style="${S.text}">${bodyHtml(deal.body)}</p>\n` : '') +
    `      <a href="${escapeHtml(go)}" style="${S.cta}">${escapeHtml(L.bookDirect)}</a>\n` +
    `      <p style="${S.claim}"><a href="${escapeHtml(claim)}" style="${S.link}">${escapeHtml(L.booked)}</a></p>\n` +
    `    </div>\n`;

  const text =
    `${deal.headline}\n` +
    `${meta}\n` +
    `${price}${was ? ` · ${was}` : ''}\n` +
    (deal.body ? `${deal.body}\n` : '') +
    `${L.bookDirect} ${go}\n` +
    `${L.booked}: ${claim}\n\n`;

  return { html, text };
}

/** An expired deal for the free nurture: what it cost, how long it stayed,
 *  and — only when the real count is above zero — how many booked. No CTA,
 *  no claim link: the fare is gone. */
function missedCard(deal: MissedDeal): { html: string; text: string } {
  const price = eur(num(deal.price) ?? 0);
  const meta = [route(deal), dates(deal)].filter(Boolean).join(' · ');
  const facts = [L.lasted(deal.lastedHours), deal.bookedCount > 0 ? L.bookedN(deal.bookedCount) : null]
    .filter((x): x is string => x != null)
    .join(' · ');

  const html =
    `    <div style="${S.card}">\n` +
    `      <p style="${S.headline}">${escapeHtml(deal.headline)}</p>\n` +
    `      <p style="${S.meta}">${escapeHtml(meta)}</p>\n` +
    `      <p style="${S.price}">${escapeHtml(price)}</p>\n` +
    `      <p style="${S.meta}">${escapeHtml(facts)}</p>\n` +
    `    </div>\n`;

  const text = `${deal.headline}\n${meta}\n${price}\n${facts}\n\n`;
  return { html, text };
}

// ---------------------------------------------------------------------------
// Renderers

/** Paid instant stream: one deal, the minute it is published. */
export function renderInstant(deal: Deal, r: Recipient, issueId: number | null): Rendered {
  const card = dealCard(deal, r, issueId);
  const { html, text } = shell(r, card);
  return { subject: L.instantSubject(deal), html, text };
}

/** True when the deal's newsletter tag maps to a persona the subscriber
 *  picked at signup (`personas.json[newsletterTag] ∩ prefs.moments`). */
function matchesMoments(deal: Deal, moments: string[]): boolean {
  if (moments.length === 0 || !deal.newsletterTag) return false;
  const codes = PERSONAS[deal.newsletterTag] ?? [];
  return codes.some((c) => moments.includes(c));
}

/** Paid Thursday digest. Deals whose personas intersect the subscriber's
 *  moments come first under „Atostogų radaras"; the rest under „Savaitės
 *  radinys". Either block is omitted when empty; relative order within a
 *  block is the caller's. */
export function renderDigest(deals: Deal[], r: Recipient, issueId: number | null): Rendered {
  const moments = momentCodes(r);
  const mine = deals.filter((d) => matchesMoments(d, moments));
  const rest = deals.filter((d) => !matchesMoments(d, moments));

  const parts: { html: string; text: string }[] = [];
  if (mine.length) parts.push(heading(L.family), ...mine.map((d) => dealCard(d, r, issueId)));
  if (rest.length) parts.push(heading(L.headline), ...rest.map((d) => dealCard(d, r, issueId)));

  const { html, text } = shell(r, join(parts));
  return { subject: L.digestSubject(deals.length), html, text };
}

/** Free 10-day nurture: fresh deals under „Savaitės radinys", what expired
 *  under „Ką praleidai" (real price, how long it lasted, real booked count),
 *  then one upgrade link under „Gauk kiekvieną radinį tą pačią minutę" —
 *  the whole block is omitted when no payment link is configured. */
export function renderNurture(fresh: Deal[], missed: MissedDeal[], r: Recipient, issueId: number | null): Rendered {
  const parts: { html: string; text: string }[] = [];
  if (fresh.length) parts.push(heading(L.headline), ...fresh.map((d) => dealCard(d, r, issueId)));
  if (missed.length) parts.push(heading(L.missed), ...missed.map(missedCard));

  const up = upgradeUrl(r.id);
  if (up) {
    parts.push({
      html:
        `    <p style="${S.text}"><a href="${escapeHtml(up)}" style="${S.upgradeLink}">${escapeHtml(L.upgrade)}</a></p>\n`,
      text: `${L.upgrade}: ${up}\n\n`,
    });
  }

  const { html, text } = shell(r, join(parts));
  return { subject: L.nurtureSubject(fresh.length), html, text };
}

function join(parts: { html: string; text: string }[]): { html: string; text: string } {
  return { html: parts.map((p) => p.html).join(''), text: parts.map((p) => p.text).join('') };
}
