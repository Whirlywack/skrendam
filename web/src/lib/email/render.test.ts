import { afterEach, describe, expect, it, vi } from 'vitest';

// `render.ts` pulls `momentCodes` from `../subscribers`, whose sibling
// `activeSubscribers` needs a live Neon connection — replace the db module
// before import, exactly as `subscribers.test.ts` does.
vi.mock('@/db', () => ({ db: {}, subscribers: {} }));

import { city } from '../airports';
import { eur } from '../format';
import { unsubscribeUrl } from '../links';
import { refCode } from '../refcode';
import type { Recipient } from '../subscribers';
import { L } from './copy';
import { formatDatesLt, ltCity } from './format-lt';
import CITIES_LT from './cities-lt.json';
import { dealCard, renderDigest, renderInstant, renderNurture, type Deal, type MissedDeal } from './render';
import { DIGEST_DAY, DIGEST_TIME, FREE_LETTER_CADENCE_DAYS, FREE_LETTER_FRESH, FREE_LETTER_MISSED } from '../letters';

afterEach(() => { vi.unstubAllEnvs(); });

const BANNED = /akcija|superkaina|nepraleisk|skenuo/i;

function deal(over: Partial<Deal> = {}): Deal {
  return {
    id: 42,
    candidateId: 1,
    dealTemplateId: 1,
    contentDraftId: null,
    publicLabel: null,
    newsletterTag: 'xmas',
    headline: 'Kalėdos Londone už 93 €',
    body: 'Kalėdų atostogos — €93, įprastai apie €275\n1 persėdimas',
    tiktokHook: null,
    origin: 'VNO',
    destination: 'STN',
    zone: null,
    tripType: 'roundtrip',
    travelDate: '2026-12-22',
    returnDate: '2026-12-28',
    price: 93,
    baselinePrice: 275,
    discountPct: 66,
    bookingUrl: null,
    validUntil: null,
    lastSeenAt: null,
    tier: 'great',
    status: 'live',
    publishedAt: '2026-09-10 07:00:00',
    goingFast: false,
    unverifiedSince: null,
    postedTiktokAt: null,
    postedInstagramAt: null,
    expiredAt: null,
    ...over,
  };
}

function recipient(over: Partial<Recipient> = {}): Recipient {
  return { id: 5, email: 'a@b.lt', plan: 'paid', prefs: null, unsubscribeToken: 'tok-123', ...over };
}

function missed(over: Partial<MissedDeal> = {}): MissedDeal {
  return { ...deal({ id: 7, status: 'expired', expiredAt: '2026-09-08 10:00:00' }), lastedHours: 36, bookedCount: 0, ...over };
}

/** Every http(s) URL in a string, for html/text twin comparison. */
function urls(s: string): string[] {
  return [...new Set(s.match(/https?:\/\/[^\s"'<>]+/g) ?? [])].map((u) => u.replace(/&amp;/g, '&')).sort();
}

describe('letters constants (spec §6)', () => {
  it('carries the free-letter cadence and digest labels verbatim', () => {
    expect(FREE_LETTER_CADENCE_DAYS).toBe(10);
    expect(FREE_LETTER_FRESH).toBe(2);
    expect(FREE_LETTER_MISSED).toBe(3);
    expect(DIGEST_DAY).toBe('Thursday');
    expect(DIGEST_TIME).toBe('07:00');
  });
});

describe('format-lt (mirrors site/src/lib/format.ts and cities-lt.ts)', () => {
  it('formatDatesLt: one-way, same month, cross month with the spaced en dash', () => {
    expect(formatDatesLt('2026-12-22', null)).toBe('gruod. 22');
    expect(formatDatesLt('2026-12-22', '2026-12-28')).toBe('gruod. 22–28');
    expect(formatDatesLt('2026-09-29', '2026-10-02')).toBe('rugs. 29 – spal. 2');
    expect(formatDatesLt('2027-01-05', '2027-01-09')).toBe('saus. 5–9');
  });
  it('ltCity: nominative from the JSON, byte-identical to the site copy', () => {
    expect(ltCity('STN').nom).toBe('Londonas');
    expect(ltCity('STN')).toEqual((CITIES_LT as Record<string, unknown>).STN);
    expect(ltCity('VNO').nom).toBe('Vilnius');
  });
});

describe('copy (spec §7 verbatim)', () => {
  it('headings and labels', () => {
    expect(L.headline).toBe('Savaitės radinys');
    expect(L.family).toBe('Atostogų radaras');
    expect(L.missed).toBe('Ką praleidai');
    expect(L.upgrade).toBe('Gauk kiekvieną radinį tą pačią minutę');
    expect(L.booked).toBe('Užsisakiau');
    expect(L.unsub).toBe('Atsisakyti laiškų');
    expect(L.bookDirect).toBe('Į bilietus →');
    expect(L.nurtureSubject).toBe('Ką praleidai — ir du nauji radiniai');
  });
  it('functions', () => {
    expect(L.bookedN(3)).toBe('3 prenumeratorių užsisakė');
    expect(L.digestSubject(4)).toBe('Savaitės radiniai: 4');
    expect(L.lasted(36)).toBe('išbuvo 36 val.');
    expect(L.lasted(72)).toBe('išbuvo 3 d.');
    expect(L.usually(275)).toBe(`įprastai ${eur(275)}`);
    expect(L.instantSubject({ price: 93, destination: 'STN' })).toBe(`${eur(93)} — Londonas`);
  });
});

describe('dealCard', () => {
  it('shows headline, dates, price, „įprastai" (discount ≥ 30), body with <br>, CTA and claim links', () => {
    const { html, text } = dealCard(deal(), recipient(), 9);
    expect(html).toContain('Kalėdos Londone už 93 €');
    expect(html).toContain('gruod. 22–28');
    expect(html).toContain('Vilnius → Londonas · gruod. 22–28');
    expect(html).not.toContain('Dec');
    expect(html).toContain(eur(93));
    expect(html).toContain(L.usually(275));
    expect(html).toContain('€93, įprastai apie €275<br>1 persėdimas');
    expect(html).toContain(`/go/42?i=9&amp;s=${refCode(5)}`);
    expect(html).toContain(`/uzsisakiau/42?i=9&amp;s=${refCode(5)}`);
    expect(html).toContain(L.bookDirect);
    expect(html).toContain(L.booked);
    expect(text).toContain(`/go/42?i=9&s=${refCode(5)}`);
    expect(text).toContain(`/uzsisakiau/42?i=9&s=${refCode(5)}`);
    expect(text).toContain(L.usually(275));
    expect(text).toContain('1 persėdimas');
  });
  it('omits „įprastai" below WAS_PRICE_MIN_DROP_PCT and when baseline is missing', () => {
    expect(dealCard(deal({ discountPct: 20 }), recipient(), 9).html).not.toContain(L.usually(275));
    expect(dealCard(deal({ discountPct: 20 }), recipient(), 9).text).not.toContain(L.usually(275));
    expect(dealCard(deal({ baselinePrice: null }), recipient(), 9).html).not.toContain(L.usually(275));
  });
  it('coerces numeric-string price/baseline/discount columns', () => {
    const d = deal({ price: '93' as unknown as number, baselinePrice: '275.4' as unknown as number, discountPct: '66' as unknown as number });
    const { html } = dealCard(d, recipient(), 9);
    expect(html).toContain(eur(93));
    expect(html).toContain(L.usually(275));
  });
  it('escapes curator text — a <b> in the headline never becomes markup', () => {
    const { html } = dealCard(deal({ headline: 'Pigu <b>labai</b> & greitai' }), recipient(), 9);
    expect(html).not.toContain('<b>');
    expect(html).toContain('Pigu &lt;b&gt;labai&lt;/b&gt; &amp; greitai');
  });
  it('renders a one-way date, a cross-month range, and survives a null travel date', () => {
    expect(dealCard(deal({ returnDate: null }), recipient(), 9).html).toContain('gruod. 22');
    expect(dealCard(deal({ travelDate: '2026-09-29', returnDate: '2026-10-02' }), recipient(), 9).html)
      .toContain('rugs. 29 – spal. 2');
    expect(() => dealCard(deal({ travelDate: null, returnDate: null }), recipient(), 9)).not.toThrow();
  });
});

describe('renderInstant', () => {
  it('subject is the hero number and the LT nominative city from cities-lt.json', () => {
    expect(renderInstant(deal(), recipient(), 9).subject).toBe(`${eur(93)} — Londonas`);
    expect(renderInstant(deal(), recipient(), 9).subject).toBe(`${eur(93)} — ${ltCity('STN').nom}`);
  });
  it('falls back to the English airports.json name for a code cities-lt.json lacks', () => {
    // Every airports.json code currently has an LT entry, so the only reachable
    // fallback is a code unknown to both maps, where city() yields the code.
    expect(ltCity('ZZZ').nom).toBe(city('ZZZ'));
    expect(renderInstant(deal({ destination: 'ZZZ' }), recipient(), 9).subject).toBe(`${eur(93)} — ${city('ZZZ')}`);
  });
  it('html carries the tracked deal link and the unsubscribe link', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { html, text } = renderInstant(deal(), recipient(), 9);
    expect(html).toContain(`/go/42?i=9&amp;s=${refCode(5)}`);
    expect(html).toContain('atsisakyti?token=tok-123');
    expect(html).toContain(unsubscribeUrl('tok-123'));
    expect(html).toContain(L.unsub);
    expect(html).toContain(L.usually(275));
    expect(html).toContain('<html lang="lt">');
    expect(text).toContain(unsubscribeUrl('tok-123'));
  });
  it('drops „įprastai" when discount is under the gate', () => {
    const { html, text } = renderInstant(deal({ discountPct: 20 }), recipient(), 9);
    expect(html).not.toContain(L.usually(275));
    expect(text).not.toContain(L.usually(275));
  });
  it('text twin is non-empty and carries the same URLs as the html', () => {
    const { html, text } = renderInstant(deal(), recipient(), 9);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(urls(text)).toEqual(urls(html));
  });
  it('accepts a null issue id (i= left empty)', () => {
    expect(renderInstant(deal(), recipient(), null).html).toContain(`/go/42?i=&amp;s=${refCode(5)}`);
  });
});

describe('renderDigest', () => {
  const family = deal({ id: 1, newsletterTag: 'family_sun', headline: 'Šeimai į Maljorką', destination: 'PMI' });
  const sun = deal({ id: 2, newsletterTag: 'winter_sun', headline: 'Saulė Tenerifėje', destination: 'TFS' });

  it('subject counts the deals', () => {
    expect(renderDigest([family, sun], recipient(), 9).subject).toBe('Savaitės radiniai: 2');
  });
  it('puts persona-matching deals first under L.family for a family subscriber', () => {
    const { html, text } = renderDigest([sun, family], recipient({ prefs: { moments: ['family'] } }), 9);
    expect(html.indexOf('Šeimai į Maljorką')).toBeLessThan(html.indexOf('Saulė Tenerifėje'));
    expect(html.indexOf(L.family)).toBeLessThan(html.indexOf(L.headline));
    expect(html.indexOf(L.family)).toBeLessThan(html.indexOf('Šeimai į Maljorką'));
    expect(text.indexOf('Šeimai į Maljorką')).toBeLessThan(text.indexOf('Saulė Tenerifėje'));
  });
  it('reverses the order for a sun subscriber', () => {
    const { html } = renderDigest([family, sun], recipient({ prefs: { moments: ['sun'] } }), 9);
    expect(html.indexOf('Saulė Tenerifėje')).toBeLessThan(html.indexOf('Šeimai į Maljorką'));
  });
  it('has no family block when nothing matches (no moments picked)', () => {
    const { html } = renderDigest([family, sun], recipient(), 9);
    expect(html).not.toContain(L.family);
    expect(html).toContain(L.headline);
    expect(html.indexOf('Šeimai į Maljorką')).toBeLessThan(html.indexOf('Saulė Tenerifėje'));
  });
  it('has no rest block when everything matches', () => {
    const { html } = renderDigest([family], recipient({ prefs: { moments: ['family'] } }), 9);
    expect(html).toContain(L.family);
    expect(html).not.toContain(L.headline);
  });
  it('links every deal, tracked with the issue id, and ends with unsubscribe', () => {
    const { html, text } = renderDigest([family, sun], recipient(), 9);
    expect(html).toContain(`/go/1?i=9&amp;s=${refCode(5)}`);
    expect(html).toContain(`/go/2?i=9&amp;s=${refCode(5)}`);
    expect(html).toContain('atsisakyti?token=tok-123');
    expect(urls(text)).toEqual(urls(html));
  });
});

describe('renderNurture', () => {
  const fresh = [deal({ id: 1, headline: 'Naujas radinys A' }), deal({ id: 2, headline: 'Naujas radinys B' })];

  it('subject is the nurture line', () => {
    expect(renderNurture(fresh, [missed()], recipient({ plan: 'free' }), 9).subject).toBe(L.nurtureSubject);
  });
  it('fresh under L.headline, missed under L.missed with real price and lasted line', () => {
    const { html, text } = renderNurture(fresh, [missed({ lastedHours: 36 })], recipient({ plan: 'free' }), 9);
    expect(html.indexOf(L.headline)).toBeLessThan(html.indexOf('Naujas radinys A'));
    expect(html.indexOf('Naujas radinys B')).toBeLessThan(html.indexOf(L.missed));
    expect(html.indexOf(L.missed)).toBeLessThan(html.indexOf('išbuvo 36 val.'));
    expect(html).toContain(eur(93));
    expect(text).toContain('išbuvo 36 val.');
  });
  it('says „išbuvo 3 d." for 72 hours', () => {
    const { html } = renderNurture(fresh, [missed({ lastedHours: 72 })], recipient({ plan: 'free' }), 9);
    expect(html).toContain('išbuvo 3 d.');
  });
  it('shows bookedN only when the real count is > 0', () => {
    const none = renderNurture(fresh, [missed({ bookedCount: 0 })], recipient({ plan: 'free' }), 9);
    expect(none.html).not.toContain('prenumeratorių užsisakė');
    expect(none.text).not.toContain('prenumeratorių užsisakė');
    const some = renderNurture(fresh, [missed({ bookedCount: 3 })], recipient({ plan: 'free' }), 9);
    expect(some.html).toContain('3 prenumeratorių užsisakė');
    expect(some.text).toContain('3 prenumeratorių užsisakė');
  });
  it('missed cards have no CTA or claim link (the deal is gone)', () => {
    const { html } = renderNurture([], [missed()], recipient({ plan: 'free' }), 9);
    expect(html).not.toContain('/go/7?');
    expect(html).not.toContain('/uzsisakiau/7?');
  });
  it('omits the upgrade block entirely when no payment link is configured', () => {
    vi.stubEnv('PAYMENT_LINK_URL', '');
    const { html, text } = renderNurture(fresh, [missed()], recipient({ plan: 'free' }), 9);
    expect(html).not.toContain(L.upgrade);
    expect(text).not.toContain(L.upgrade);
    expect(html).not.toContain('client_reference_id');
  });
  it('carries exactly one upgrade link with client_reference_id when configured', () => {
    vi.stubEnv('PAYMENT_LINK_URL', 'https://buy.stripe.com/test_abc');
    const { html, text } = renderNurture(fresh, [missed()], recipient({ plan: 'free' }), 9);
    expect(html).toContain(L.upgrade);
    expect(html.match(/client_reference_id/g)).toHaveLength(1);
    expect(html).toContain(`https://buy.stripe.com/test_abc?client_reference_id=${refCode(5)}`);
    expect(text).toContain(`https://buy.stripe.com/test_abc?client_reference_id=${refCode(5)}`);
  });
  it('ends with unsubscribe and the text twin mirrors the html URLs', () => {
    vi.stubEnv('PAYMENT_LINK_URL', 'https://buy.stripe.com/test_abc');
    const { html, text } = renderNurture(fresh, [missed()], recipient({ plan: 'free' }), 9);
    expect(html).toContain('atsisakyti?token=tok-123');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(urls(text)).toEqual(urls(html));
  });
});

describe('copy rules across every renderer', () => {
  it('no banned words in any output', () => {
    vi.stubEnv('PAYMENT_LINK_URL', 'https://buy.stripe.com/test_abc');
    const r = recipient({ prefs: { moments: ['family'] } });
    const outs = [
      renderInstant(deal(), r, 9),
      renderDigest([deal({ id: 1, newsletterTag: 'family_sun' }), deal({ id: 2, newsletterTag: 'winter_sun' })], r, 9),
      renderNurture([deal()], [missed({ bookedCount: 2 })], recipient({ plan: 'free' }), 9),
    ];
    for (const o of outs) {
      expect(o.subject).not.toMatch(BANNED);
      expect(o.html).not.toMatch(BANNED);
      expect(o.text).not.toMatch(BANNED);
    }
  });
  it('every mail ends with the unsubscribe link and the text twin is never empty', () => {
    const r = recipient();
    for (const o of [renderInstant(deal(), r, 9), renderDigest([deal()], r, 9), renderNurture([deal()], [missed()], r, 9)]) {
      expect(o.html).toContain(unsubscribeUrl('tok-123'));
      expect(o.text).toContain(unsubscribeUrl('tok-123'));
      expect(o.text.trim()).not.toBe('');
      expect(o.text.trim().endsWith(unsubscribeUrl('tok-123'))).toBe(true);
    }
  });
});
