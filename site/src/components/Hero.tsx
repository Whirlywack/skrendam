import { Photo } from './Photo';
import { SignupCard } from './SignupCard';
import { S } from '@/lib/lt';
import { eur, ltPlural } from '@/lib/format';
import { ltCity } from '@/lib/cities-lt';
import type { TicketView } from '@/lib/types';

export function Hero({
  newCount,
  topDeal,
}: {
  newCount: number;
  topDeal: TicketView | null;
}) {
  const scene = topDeal?.scene ?? 'ph-coast';
  const captionEyebrow = S.heroCaptionEyebrow;
  const captionTitle = topDeal
    ? `${topDeal.destination}, nuo ${eur(topDeal.price)}`
    : `${ltCity('LCA').nom}, nuo ${eur(140)}`;

  return (
    <div className="hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="eyebrow">
            {S.heroEyebrow} ·{' '}
            {newCount >= 3
              ? `${newCount} ${ltPlural(newCount, 'radinys', 'radiniai', 'radinių')} — dar spėji`
              : S.heroEyebrowFallback}
          </div>
          <h1>
            <span className="amber">{S.heroTitleAmber}</span> {S.heroTitleTail}
          </h1>
          <p className="lead">{S.heroSub}</p>
          <SignupCard />
        </div>

        <Photo scene={scene} treatment="protect" className="hero-photo">
          <div className="ph-cap">
            <div className="ph-eyebrow">{captionEyebrow}</div>
            <div className="ph-title">{captionTitle}</div>
          </div>
        </Photo>
      </div>

      <div className="microproof">
        Iš <b>VNO, KUN ir RIX</b>. {S.microproofTail}
      </div>
    </div>
  );
}
