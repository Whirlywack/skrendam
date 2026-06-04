import type { Metadata } from 'next';
import { getInspirationDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DealTicket } from '@/components/DealTicket';
import { CaptureBand } from '@/components/CaptureBand';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Past rare fares · Yip',
  description:
    'Cheap flights from Vilnius, Kaunas & Riga that Yip found and that have since sold out. Proof we find real deals — get the next one by email before it disappears.',
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
        <div className="eyebrow">Expired · But useful proof</div>
        <h1 className="coll-h1">Past rare fares.</h1>
        <p className="lead">
          These are gone now. They&apos;re proof Yip finds real ones — get the next before it
          disappears.
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
            <p>No past fares to show yet.</p>
          </div>
        )}
      </div>

      <CaptureBand />
      <Footer />
    </main>
  );
}
