import Link from 'next/link';
import type { PublicDeal } from '@/lib/types';
import { QualityTag } from './QualityTag';
import { StatusLine } from './StatusLine';

export function BrowseCard({ deal }: { deal: PublicDeal }) {
  return (
    <div className="bc">
      <QualityTag quality={deal.quality} />
      <div className="dest">{deal.destination}</div>
      <div className="rt">{deal.route} · {deal.tripType === 'roundtrip' ? 'ret' : 'one-way'} · {deal.dates}</div>
      <div className="pr">€{deal.price} <small>{deal.tripType === 'roundtrip' ? 'return' : 'one-way'}</small></div>
      <div className="why">{deal.why}</div>
      {deal.catchLine && <div className="catch">{deal.catchLine}</div>}
      <StatusLine status={deal.status} />
      <Link className="see" href={`/deal/${deal.id}`}>See the deal →</Link>
    </div>
  );
}
