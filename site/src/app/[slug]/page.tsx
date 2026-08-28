import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { COLLECTIONS, collectionBySlug } from '@/lib/collections';
import { getCollectionDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DealTicket } from '@/components/DealTicket';
import { CaptureBand } from '@/components/CaptureBand';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo';
import { ltPlural } from '@/lib/format';
import { S } from '@/lib/lt';

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = collectionBySlug(slug);
  if (!c) return {};
  return {
    title: `${c.h1} · Yip`,
    description: c.promise,
    alternates: { canonical: `/${c.slug}` },
    openGraph: { title: `${c.h1} · Yip`, description: c.promise },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = collectionBySlug(slug);
  if (!c) notFound();

  const now = new Date();
  const deals = (await getCollectionDeals(c.filter)).map((r) => toTicket(r, now));

  return (
    <main className="yip-collection">
      <JsonLd data={breadcrumbJsonLd([
        { name: S.navHome, path: '/' },
        { name: S.navCollections, path: '/collections' },
        { name: c.label, path: `/${c.slug}` },
      ])} />
      <Header />

      {/* Breadcrumb */}
      <nav className="crumb" aria-label="Naršymo kelias">
        <Link href="/">{S.navHome}</Link>
        {' › '}
        <Link href="/collections">{S.navCollections}</Link>
        {' › '}
        <span>{c.label}</span>
      </nav>

      {/* Collection hero */}
      <div className="coll-hero pad">
        <div className="eyebrow">{c.label} · iš VNO · KUN · RIX</div>
        <h1 className="coll-h1">{c.h1}</h1>
        <p className="lead">{c.promise}</p>
        {deals.length > 0 && (
          <p className="coll-count">
            Šiuo metu: {deals.length}{' '}
            {ltPlural(deals.length, 'gyvas radinys', 'gyvi radiniai', 'gyvų radinių')}
          </p>
        )}
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
            <p>
              „<strong>{c.label}</strong>“ gyvų radinių šiuo metu nėra — kitą gauk el. paštu.
            </p>
            <a href="#capture" className="btn-primary">
              {S.ctaSubmit}
            </a>
          </div>
        )}
      </div>

      <CaptureBand />
      <Footer />
    </main>
  );
}
