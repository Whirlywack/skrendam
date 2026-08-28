import type { Metadata } from 'next';
import Link from 'next/link';
import { COLLECTIONS } from '@/lib/collections';
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

export default function CollectionsIndex() {
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

      {/* Collections as ink-inverting rows */}
      <section className="wrap v2-sec" style={{ paddingTop: 26 }}>
        <div className="v2-rows">
          {COLLECTIONS.map((c, i) => (
            <Link key={c.slug} href={`/${c.slug}`} className="v2-row">
              <span className="no">Nr. {String(i + 1).padStart(2, '0')}</span>
              <span className="v2-row-name">{c.label}</span>
              {/* full-sentence promise — mono caps would shout, so normal case */}
              <span className="v2-row-meta" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {c.promise}
              </span>
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
