/**
 * LiveDeals — "This week · live now" section.
 *
 * Renders a featured horizontal ticket (.feat) + a .grid2 of up to 2 standard
 * .deal cards.  Shows an empty-state message when featured is null.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 175–193)
 */
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { DealTicket } from './DealTicket';

export function LiveDeals({
  featured,
  rest,
}: {
  featured: TicketView | null;
  rest: TicketView[];
}) {
  return (
    <div className="pad pad-bordered">
      <div className="eyebrow">{S.liveEyebrow}</div>

      {featured ? (
        <>
          <div className="sec-h">{featured.headline}</div>
          <DealTicket t={featured} featured />

          {rest.length > 0 && (
            <div className="grid2">
              {rest.map((t) => (
                <DealTicket key={t.id} t={t} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="sec-lead" style={{ marginTop: 12 }}>
          {S.liveEmpty}
        </p>
      )}
    </div>
  );
}
