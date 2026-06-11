import { describe, it, expect } from 'vitest';
import { safeJsonLd } from '@/components/JsonLd';
import {
  orgJsonLd,
  websiteJsonLd,
  breadcrumbJsonLd,
  dealArticleJsonLd,
} from '@/lib/seo';

// ── safeJsonLd: </script> breakout hardening ──────────────────────────────────

describe('safeJsonLd', () => {
  it('escapes < to \\u003c so </script> cannot break out of the tag', () => {
    const result = safeJsonLd({ a: '</script>' });
    expect(result).toContain('\\u003c');
    expect(result).not.toContain('</script>');
  });

  it('handles nested objects containing <', () => {
    const result = safeJsonLd({ nested: { key: '<evil>' } });
    expect(result).not.toContain('<evil>');
    expect(result).toContain('\\u003c');
  });
});

// ── breadcrumbJsonLd: positions are 1-based + items use absolute URLs ─────────

describe('breadcrumbJsonLd', () => {
  const items = [
    { name: 'Home', path: '/' },
    { name: 'Deals', path: '/deals' },
    { name: 'Paris', path: '/deal/42' },
  ];
  const ld = breadcrumbJsonLd(items);

  it('first item has position 1', () => {
    expect(ld.itemListElement[0].position).toBe(1);
  });

  it('positions are sequential and 1-based', () => {
    ld.itemListElement.forEach((el, i) => {
      expect(el.position).toBe(i + 1);
    });
  });

  it('item URLs are absolute (start with http)', () => {
    ld.itemListElement.forEach((el) => {
      expect(el.item).toMatch(/^https?:\/\//);
    });
  });

  it('item URLs include the path', () => {
    expect(ld.itemListElement[2].item).toContain('/deal/42');
  });
});

// ── Price-free guard: no Offer/price/priceCurrency in any builder ─────────────

function flatKeys(obj: unknown): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  const keys = Object.keys(obj as Record<string, unknown>);
  const nested = Object.values(obj as Record<string, unknown>).flatMap(flatKeys);
  return [...keys, ...nested];
}

describe('JSON-LD builders: no price/Offer keys (regression guard)', () => {
  const builders = [
    orgJsonLd(),
    websiteJsonLd(),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }]),
    dealArticleJsonLd({
      id: 1,
      headline: 'Test deal',
      description: 'A cheap flight',
      datePublished: '2026-06-04T00:00:00Z',
    }),
  ];

  builders.forEach((ld, idx) => {
    it(`builder[${idx}] contains no "offers" key`, () => {
      expect(flatKeys(ld)).not.toContain('offers');
    });
    it(`builder[${idx}] contains no "price" key`, () => {
      expect(flatKeys(ld)).not.toContain('price');
    });
    it(`builder[${idx}] contains no "priceCurrency" key`, () => {
      expect(flatKeys(ld)).not.toContain('priceCurrency');
    });
  });
});

// ── dealArticleJsonLd: correct shape ─────────────────────────────────────────

describe('dealArticleJsonLd', () => {
  const ld = dealArticleJsonLd({
    id: 99,
    headline: 'Paris for €89',
    description: 'Direct return to Paris, 30% below typical.',
    datePublished: '2026-06-04T10:00:00Z',
  });

  it('@type is Article', () => {
    expect(ld['@type']).toBe('Article');
  });

  it('mainEntityOfPage includes deal id', () => {
    expect(ld.mainEntityOfPage).toContain('/deal/99');
  });

  it('publisher @type is Organization', () => {
    expect(ld.publisher['@type']).toBe('Organization');
  });

  it('headline is set', () => {
    expect(ld.headline).toBe('Paris for €89');
  });
});

// ── orgJsonLd: no logo key (no logo asset present) ───────────────────────────

describe('orgJsonLd', () => {
  const ld = orgJsonLd();

  it('@type is Organization', () => {
    expect(ld['@type']).toBe('Organization');
  });

  it('does not include a logo key (no logo asset exists)', () => {
    expect(flatKeys(ld)).not.toContain('logo');
  });
});
