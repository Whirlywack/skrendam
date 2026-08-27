/**
 * Faq — ".faq" accordion using native <details>/<summary>.
 *
 * Export HOME_FAQ for the homepage; other pages can supply their own items.
 * The first item is open by default (matches the mockup).
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 241–246)
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes — the weekly email is free. "Early alerts" (the fastest fares) is free to join while it\'s getting started; a paid tier may come later, and waitlist members hear first.',
  },
  {
    q: 'How do you find these?',
    a: "We track prices on every route daily and a human checks each fare is real before it reaches you. We're a local curator, not a search engine.",
  },
  {
    q: 'Do I book with Yip?',
    a: 'No — you book direct with the airline (or via Google Flights). We just find and verify the deal and show you the live price.',
  },
];

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      <div className="eyebrow">Good to know</div>
      <div className="sec-h">Questions, answered.</div>

      {items.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary>{item.q}</summary>
          <div className="a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
