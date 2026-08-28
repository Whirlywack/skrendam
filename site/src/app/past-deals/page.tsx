import type { Metadata } from 'next';
import { getInspirationDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DealTicket } from '@/components/DealTicket';
import { CaptureBand } from '@/components/CaptureBand';
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
    <main className="yip-site">
      <Header />

      {/* Hero band */}
      <div className="coll-hero pad">
        <div className="eyebrow">Nebegalioja · bet įrodo</div>
        <h1 className="coll-h1">{S.trophyHeader}</h1>
        <p className="lead">
          Šitų jau nebėra. Bet jie įrodo, kad randam tikrus — kitą gauk el. paštu, kol nedingo.
        </p>
      </div>

      {/* Deal grid or empty state */}
      <div className="pad" style={{ paddingTop: 0 }}>
        {deals.length > 0 ? (
          <div className="grid3">
            {deals.map((d) => (
              <DealTicket key={d.id} t={d} />
            ))}
          </div>
        ) : (
          <div className="coll-empty">
            <p>Kol kas nėra ką rodyti.</p>
          </div>
        )}
      </div>

      <CaptureBand />
      <Footer />
    </main>
  );
}
