import type { Metadata } from 'next';
import { getInspirationDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Masthead } from '@/components/v2/Masthead';
import { Crumb } from '@/components/v2/Crumb';
import { CaptureRow } from '@/components/v2/CaptureRow';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';
import { eur } from '@/lib/format';
import { WAS_PRICE_MIN_DROP_PCT } from '@/lib/format-rules';
import { S } from '@/lib/lt';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Buvę radiniai · Yip',
  description:
    'Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos, kuriuos radom — ir kurie jau išpirkti. Įrodymas, kad randam tikrus. Kitą gauk el. paštu, kol nedingo.',
  alternates: { canonical: '/past-deals' },
};

export default async function PastDeals() {
  const now = new Date();
  const deals = (await getInspirationDeals(48)).map((r) => toTicket(r, now));

  return (
    <main className="v2">
      <Masthead />

      <Crumb items={[
        { label: S.navDeals, href: '/' },
        { label: S.trophyHeader },
      ]} />

      {/* Hero */}
      <section className="wrap v2-hero" style={{ padding: '34px 0 10px' }}>
        <div className="v2-kicker v2-kicker--dim">{S.pastEyebrow}</div>
        <h1 className="v2-display" style={{ fontSize: 'var(--d-h1, clamp(38px, 5vw, 64px))', margin: '14px 0 0' }}>
          {S.trophyHeader}
        </h1>
        <div className="sub-row">
          <p className="lead">
            Šitų jau nebėra. Bet jie įrodo, kad randam tikrus — kitą gauk el. paštu, kol nedingo.
          </p>
        </div>
      </section>

      {/* Dead rows — the trophy case at archive length */}
      <section className="wrap v2-sec" style={{ paddingTop: 26 }}>
        {deals.length > 0 ? (
          <div className="v2-rows">
            {deals.map((t) => {
              // Depth gate: a shallow deal makes no reference-price claim in any
              // form — same rule as Poster/DealTicket/deal page.
              const was = t.baseline != null && t.baseline > t.price
                && t.drop >= WAS_PRICE_MIN_DROP_PCT ? t.baseline : null;
              const saved = was != null ? Math.round(was - t.price) : null;
              const month = t.dates.split(' ')[0]?.replace('.', '') ?? '';
              return (
                <div key={t.id} className="v2-row v2-row--dead">
                  <span className="no">{month.toUpperCase()}</span>
                  <span className="v2-row-name">{t.destination}</span>
                  <span className="v2-row-meta">
                    {t.route}{saved != null ? ` · ${S.savedWord} ${eur(saved)}` : ''} · {t.dates}
                  </span>
                  <span className="v2-row-price">
                    {eur(t.price)}{was != null && <s>{eur(was)}</s>}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mono v2-footnote" style={{ padding: '4px 0 0' }}>
            Kol kas nėra ką rodyti.
          </div>
        )}
        <div className="mono v2-footnote">{S.trophyFootnote}</div>
      </section>

      {/* 'past' is the allow-listed source — anything else downgrades to 'site' */}
      <CaptureRow source="past" />

      <InkBand />
      <V2Footer />
    </main>
  );
}
