/**
 * Faq — ".faq" accordion using native <details>/<summary>.
 *
 * Export HOME_FAQ for the homepage; other pages can supply their own items.
 * The first item is open by default (matches the mockup).
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 241–246)
 */
import { S } from '@/lib/lt';

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: FaqItem[] = [
  { q: S.faqFreeQ, a: S.faqFreeA },
  { q: S.faqHowQ, a: S.faqHowA },
  { q: S.faqBookQ, a: S.faqBookA },
];

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      <div className="eyebrow">{S.faqEyebrow}</div>
      <div className="sec-h">{S.faqHeader}</div>

      {items.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary>{item.q}</summary>
          <div className="a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
