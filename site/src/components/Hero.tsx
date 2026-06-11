import { Photo } from './Photo';
import { SignupCard } from './SignupCard';
import type { TicketView } from '@/lib/types';

export function Hero({
  newCount,
  topDeal,
}: {
  newCount: number;
  topDeal: TicketView | null;
}) {
  const scene = topDeal?.scene ?? 'ph-coast';
  const captionEyebrow = 'This week · live now';
  const captionTitle = topDeal
    ? `${topDeal.destination}, from €${topDeal.price}`
    : 'Larnaca, from €140';

  return (
    <div className="hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="eyebrow">
            Found &amp; checked by hand · {newCount} new this week
          </div>
          <h1>
            Hand-checked <span className="amber">cheap flights</span> from
            Vilnius, Kaunas and Riga.
          </h1>
          <p className="lead">
            We find the cheap ones, check they&apos;re real, and tell you why
            each is good — and the catch. You book direct.
          </p>
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
        From <b>VNO, KUN and RIX</b>. No search engine, just the good ones.
      </div>
    </div>
  );
}
