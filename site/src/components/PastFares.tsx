/**
 * PastFares — "Expired, but useful proof" strip.
 *
 * Shows a .grid3 of expired DealTicket cards with a "See all past fares →"
 * link below.  Only rendered when deals.length > 0 (caller decides).
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 199–209)
 */
import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { DealTicket } from './DealTicket';

export function PastFares({ deals }: { deals: TicketView[] }) {
  return (
    <div className="pad">
      <div className="eyebrow">{S.pastEyebrow}</div>
      <div className="sec-h">{S.trophyHeader}</div>
      <p className="sec-lead">{S.trophyFootnote}</p>

      <div className="grid3">
        {deals.map((t) => (
          <DealTicket key={t.id} t={t} />
        ))}
      </div>

      <div style={{ marginTop: 13 }}>
        <Link
          href="/past-deals"
          style={{ color: 'var(--sea-ink)', fontWeight: 700, fontSize: 13 }}
        >
          {S.pastAll} →
        </Link>
      </div>
    </div>
  );
}
