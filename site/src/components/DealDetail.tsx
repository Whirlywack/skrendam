import Link from 'next/link';
import type { PublicDeal } from '@/lib/types';
import type { PriceStats } from '@/lib/priceContext';
import { PriceSparkline } from './PriceSparkline';
import { Itinerary } from './Itinerary';
import { BookingCta } from './BookingCta';

interface DealDetailProps {
  deal: PublicDeal;
  stats: PriceStats;
  snapshot: unknown;
}

export function DealDetail({ deal, stats, snapshot }: DealDetailProps) {
  const chipLabel = deal.quality === 'rare' ? 'Rare deal' : 'Great deal';

  return (
    <div className="dp">
      <Link className="back" href="/">&larr; All deals</Link>

      <div className="dpgrid">
        {/* LEFT — decide + book */}
        <div className="decide">
          <span className="chip">{chipLabel}</span>
          <div className="verdict">{deal.verdict}</div>
          <div className="price">
            &euro;{deal.price} <small>{deal.tripType === 'roundtrip' ? 'return' : 'one-way'}</small>
          </div>
          <div className="route">{deal.route} &middot; {deal.dates}</div>
          <div className="why">{deal.why}</div>
          {deal.catchLine && <div className="catch-sm">{deal.catchLine}</div>}
          <BookingCta booking={deal.booking} />
          <div className={`st${deal.status.kind === 'going_fast' ? ' st-fast' : ''}`}>
            {deal.status.kind === 'going_fast' ? '▲ ' : ''}{deal.status.label}
          </div>
        </div>

        {/* RIGHT — proof */}
        <div>
          <PriceSparkline stats={stats} todayPrice={deal.price} />
          <Itinerary snapshot={snapshot} airline={deal.airline} />

          {/* Good to know */}
          <div className="sec">
            <h3>Good to know</h3>
            <p className="gtk">
              We checked this fare{' '}
              {deal.status.kind === 'fresh'
                ? deal.status.label.replace('Checked ', '')
                : 'recently'}{' '}
              and recheck before you book. Deals like this usually last a day or two, not weeks.
            </p>
            {deal.booking.kind !== 'google' && (
              <div className="verify">
                Want to be sure?{' '}
                <a href="https://www.google.com/travel/flights" target="_blank" rel="noopener noreferrer">
                  Check it in Google Flights &rarr;
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
