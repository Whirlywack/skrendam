import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { COLLECTIONS, collectionBySlug } from '@/lib/collections';
import { getCollectionDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { Masthead } from '@/components/v2/Masthead';
import { Crumb } from '@/components/v2/Crumb';
import { LinkBand } from '@/components/v2/LinkBand';
import { DealRow } from '@/components/v2/Rows';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';
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
  const { deals: rows, lockedCount } = await getCollectionDeals(c.filter);
  const deals = rows.map((r) => toTicket(r, now));

  // Sibling collections — every collection links the others (SEO interlink)
  const siblings = COLLECTIONS.filter((x) => x.slug !== c.slug)
    .map((x) => ({ label: x.label, href: `/${x.slug}` }));

  return (
    <main className="v2">
      <JsonLd data={breadcrumbJsonLd([
        { name: S.navDeals, path: '/' },
        { name: S.navCollections, path: '/collections' },
        { name: c.label, path: `/${c.slug}` },
      ])} />
      <Masthead />

      <Crumb items={[
        { label: S.navDeals, href: '/' },
        { label: S.navCollections, href: '/collections' },
        { label: c.label },
      ]} />

      {/* Collection hero */}
      <section className="wrap v2-hero" style={{ padding: '34px 0 10px' }}>
        <div className="v2-kicker v2-kicker--dim">{c.label} · iš VNO · KUN · RIX</div>
        <h1 className="v2-display" style={{ fontSize: 'var(--d-h1, clamp(38px, 5vw, 64px))', margin: '14px 0 0' }}>
          {c.h1}
          <span className="bead" aria-hidden="true" />
        </h1>
        <div className="sub-row">
          <p className="lead">{c.promise}</p>
          {(deals.length > 0 || lockedCount > 0) && (
            <span className="v2-kicker v2-kicker--dim">
              {deals.length > 0 &&
                `Šiuo metu: ${deals.length} ${ltPlural(deals.length, 'gyvas radinys', 'gyvi radiniai', 'gyvų radinių')}`}
              {deals.length > 0 && lockedCount > 0 && ' · '}
              {lockedCount > 0 && `dar ${lockedCount} ${S.lockedInLetter}`}
            </span>
          )}
        </div>
      </section>

      {/* Deals as the home page's ink-inverting rows */}
      <section className="wrap v2-sec" style={{ paddingTop: 26 }}>
        {deals.length > 0 ? (
          <div className="v2-rows">
            {deals.map((t, i) => (
              <DealRow key={t.id} t={t} no={`Nr. ${String(i + 1).padStart(2, '0')}`} />
            ))}
          </div>
        ) : (
          <div className="mono v2-footnote" style={{ padding: '4px 0 0' }}>
            {lockedCount > 0
              ? <>„{c.label}“ radiniai šiuo metu — {S.lockedInLetter}. </>
              : <>„{c.label}“ gyvų radinių šiuo metu nėra. </>}
            <a href="#kapote">{S.ctaSubmit} →</a>
          </div>
        )}
      </section>

      <LinkBand links={siblings} />

      <InkBand />
      <V2Footer />
    </main>
  );
}
