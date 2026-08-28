import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { eur } from '@/lib/format';

// Photo scenes map onto the four duotone poster fields (photo-free art direction).
const POSTER: Record<string, string> = {
  'ph-sun': 'v2-poster--sun',
  'ph-coast': 'v2-poster--sun',
  'ph-city': 'v2-poster--stone',
  'ph-snow': 'v2-poster--sea',
  'ph-dusk': 'v2-poster--dusk',
};

export function Poster({
  t,
  count,
  freshness,
}: {
  t: TicketView;
  /** Live deals this week — poster kicker links the hero to the breadth. */
  count: number;
  /** Real freshness label from the mapper (never hardcoded). */
  freshness: string;
}) {
  const [o, , d] = t.route.split(' ');
  const save = t.baseline != null && t.baseline > t.price ? Math.round(t.baseline - t.price) : null;
  // The price already dominates the poster — a price-shaped headline fallback
  // would say it twice, so only curator prose earns the blurb slot.
  const blurb = /\d+\s?€/.test(t.headline) ? null : t.headline;
  return (
    <section className="wrap">
      <div className={`v2-poster ${POSTER[t.scene] ?? 'v2-poster--sun'}`}>
        <div className="top">
          <span className="kicker">
            Nr. 01 {count > 1 ? `iš ${String(count).padStart(2, '0')} ` : ''}{S.thisWeekOf} — {t.eyebrow}
          </span>
          <span className="stamp stamp--light">
            {t.quality === 'rare' ? S.badgeRare : S.badgeGreat}
          </span>
        </div>
        <div>
          <div className="disp name">{t.destination}</div>
          {blurb && <p className="blurb">{blurb}</p>}
        </div>
        <div className="foot">
          <div className="routebox" aria-hidden="true">
            <div className="mono ends"><span>{o}</span><span>{t.legs.toUpperCase()}</span><span>{d}</span></div>
            <div className="bead-route"><span className="track" /><span className="bead" /></div>
          </div>
          <div className="pricecell">
            <div>
              <div className="disp price">
                {eur(t.price)}
                {t.baseline != null && <s>{eur(t.baseline)}</s>}
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
