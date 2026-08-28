import type { Metadata } from 'next';
import Link from 'next/link';
import { COLLECTIONS } from '@/lib/collections';
import { POSTER } from '@/components/v2/Poster';
import { Masthead } from '@/components/v2/Masthead';
import { Crumb } from '@/components/v2/Crumb';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';
import { S } from '@/lib/lt';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Kryptys · Yip',
  description:
    'Žmogaus patikrinti pigūs skrydžiai pagal išvykimo miestą ir kelionės tipą — Vilnius, Kaunas, Ryga, rugsėjo saulė, Kalėdų mugės, Kipras.',
  alternates: { canonical: '/collections' },
};

// „Pigūs skrydžiai iš Vilniaus" → „Iš Vilniaus" — the SEO phrase stays in the
// slug/label/metadata; the tile face reads like a poster, not a keyword.
const shortLabel = (c: (typeof COLLECTIONS)[number]) =>
  c.label.startsWith('Pigūs skrydžiai iš ') ? `Iš ${c.label.slice('Pigūs skrydžiai iš '.length)}` : c.label;

export default function CollectionsIndex() {
  const origins = COLLECTIONS.filter((c) => c.filter.kind === 'origin');
  const moments = COLLECTIONS.filter((c) => c.filter.kind !== 'origin');
  return (
    <main className="v2">
      <Masthead />

      <Crumb items={[
        { label: S.navDeals, href: '/' },
        { label: S.navCollections },
      ]} />

      {/* Page heading */}
      <section className="wrap v2-hero" style={{ padding: '34px 0 10px' }}>
        <div className="v2-kicker v2-kicker--dim">{S.collEyebrow}</div>
        <h1 className="v2-display" style={{ fontSize: 'var(--d-h1, clamp(38px, 5vw, 64px))', margin: '14px 0 0' }}>
          {S.collHeader}
          <span className="bead" aria-hidden="true" />
        </h1>
        <div className="sub-row">
          <p className="lead">
            Žmogaus patikrinti pigūs skrydžiai pagal išvykimo miestą ir kelionės momentą.
            Kiekvieną radinį patikrino gyvas žmogus — sakom, kodėl verta ir koks kabliukas.
          </p>
        </div>
      </section>

      {/* Two growth axes: origins are stable (3 poster tiles, stubs on mobile);
          moments/zones keep growing — compact duotone stubs scale like a list */}
      <section className="wrap v2-sec" style={{ paddingTop: 26 }}>
        <div className="v2-kicker v2-kicker--dim" style={{ marginBottom: 14 }}>{S.collOrigins}</div>
        <div className="v2-tiles">
          {origins.map((c, i) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className={`v2-tile ${POSTER[c.scene] ?? 'v2-poster--sun'}`}
              aria-label={c.label}
            >
              <span className="no">Nr. {String(i + 1).padStart(2, '0')}</span>
              <span className="nm">{shortLabel(c)}<span className="bead" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap v2-sec" style={{ paddingTop: 40 }}>
        <div className="v2-kicker v2-kicker--dim" style={{ marginBottom: 14 }}>{S.collMoments}</div>
        <div className="v2-stubs">
          {moments.map((c, i) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className={`v2-stub ${POSTER[c.scene] ?? 'v2-poster--sun'}`}
              aria-label={c.label}
            >
              <span className="no">Nr. {String(origins.length + i + 1).padStart(2, '0')}</span>
              <span className="nm">{c.label}</span>
              <span className="go" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <InkBand />
      <V2Footer />
    </main>
  );
}
