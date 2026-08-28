import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Collections } from '@/components/Collections';
import { Footer } from '@/components/Footer';
import { S } from '@/lib/lt';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Kryptys · Yip',
  description:
    'Žmogaus patikrinti pigūs skrydžiai pagal išvykimo miestą ir kelionės tipą — Vilnius, Kaunas, Ryga, rugsėjo saulė, Kalėdų mugės, Kipras.',
  alternates: { canonical: '/collections' },
};

export default function CollectionsIndex() {
  return (
    <main className="yip-collections-index">
      <Header />

      {/* Page heading band */}
      <div className="coll-hero pad">
        <div className="eyebrow">{S.collEyebrow}</div>
        <h1 className="coll-h1">{S.collHeader}</h1>
        <p className="lead">
          Žmogaus patikrinti pigūs skrydžiai pagal išvykimo miestą ir kelionės momentą.
          Kiekvieną radinį patikrino gyvas žmogus — sakom, kodėl verta ir koks kabliukas.
        </p>
      </div>

      {/* Tile grid — suppress the duplicate heading since we have a page H1 above */}
      <Collections showHeading={false} />

      <Footer />
    </main>
  );
}
