import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Collections } from '@/components/Collections';
import { Footer } from '@/components/Footer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Flight-deal collections · Yip',
  description:
    'Browse hand-checked cheap flights by departure city and travel moment — Vilnius, Kaunas, Riga, September sun, Christmas markets, Cyprus.',
  alternates: { canonical: '/collections' },
};

export default function CollectionsIndex() {
  return (
    <main className="yip-collections-index">
      <Header />

      {/* Page heading band */}
      <div className="coll-hero pad">
        <div className="eyebrow">Browse by</div>
        <h1 className="coll-h1">Where do you want to go?</h1>
        <p className="lead">
          Hand-checked cheap flights by departure city and travel moment. Every deal is verified
          by a real person — we tell you why it&apos;s good, and the catch.
        </p>
      </div>

      {/* Tile grid — suppress the duplicate heading since we have a page H1 above */}
      <Collections showHeading={false} />

      <Footer />
    </main>
  );
}
