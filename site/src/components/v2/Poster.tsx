import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { eur } from '@/lib/format';
import { WAS_PRICE_MIN_DROP_PCT } from '@/lib/format-rules';

// Photo scenes map onto the design system's duotone poster fields.
// Exported: the deal page's poster hero shares the mapping.
export const POSTER: Record<string, string> = {
  'ph-sun': 'v2-poster--sun',
  'ph-coast': 'v2-poster--sun',
  'ph-city': 'v2-poster--stone',
  'ph-snow': 'v2-poster--sea',
  'ph-dusk': 'v2-poster--dusk',
  'ph-market': 'v2-poster--dusk',
};

export function Poster({
  t,
  count,
  /** Real freshness label from the mapper (never hardcoded). */
  freshness,
  /** LT verdict line — fills the blurb slot when the curator wrote no prose. */
  hook,
}: {
  t: TicketView;
  count: number;
  freshness: string;
  hook: string;
}) {
  const [o, , d] = t.route.split(' ');
  const save = t.baseline != null && t.baseline > t.price ? Math.round(t.baseline - t.price) : null;
  // Same gate as DealTicket: a shallow discount earns no strikethrough (review 08-28).
  const showWas = t.baseline != null && t.drop >= WAS_PRICE_MIN_DROP_PCT;
  // The price already dominates the poster — a price-shaped headline fallback
  // would say it twice, so those fall back to the verdict line instead.
  const blurb = /\d+\s?€/.test(t.headline) ? hook : t.headline;
  return (
    <section className="wrap">
      <div className={`v2-poster ${POSTER[t.scene] ?? 'v2-poster--sun'}`}>
        <div className="top">
          <span className="v2-kicker">
            {S.dealNoWord} Nr. 01{count > 1 ? ` iš ${String(count).padStart(2, '0')}` : ''} · {S.thisWeekOf}
          </span>
          <span className="v2-stamp v2-stamp--light">
            {t.quality === 'rare' ? S.badgeRare : S.badgeGreat}
          </span>
        </div>
        <div>
          <div className="v2-poster-name">{t.destination}</div>
          {blurb && <p className="blurb">{blurb}</p>}
        </div>
        <div className="foot">
          <div className="routebox" aria-hidden="true">
            <div className="mono ends"><span>{o}</span><span>{t.legs.toUpperCase()}</span><span>{d}</span></div>
            <div className="bead-route"><span className="track" /><span className="bead" /></div>
          </div>
          <div className="pricecell">
            <div>
              <div className="v2-price price">
                {eur(t.price)}
                {showWas && <s>{eur(t.baseline!)}</s>}
              </div>
              {save != null && (
                <div className="mono save">{S.saveWord} {eur(save)} {S.youSaveVs}</div>
              )}
            </div>
            <Link href={`/deal/${t.id}`} className="cta">
              {S.ctaSeeDealHero} <span className="bead" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      <div className="mono v2-catchline">
        <span>{t.catchChip}</span>
        <span>{t.dates}</span>
        <span>{t.airline} · {freshness.toLowerCase()}</span>
      </div>
    </section>
  );
}
