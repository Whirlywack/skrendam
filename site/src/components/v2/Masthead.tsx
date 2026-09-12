import Link from 'next/link';
import { S } from '@/lib/lt';

/** Sticky V2 masthead — the amber pill is the page's persistent capture CTA
    (founder call 08-28: the CTA must be unmissable). Nav is deliberately two
    links: the homepage is the catalog, /collections is the only hub (IA
    decision 08-28) — origin pages live in footer/crumbs/link bands, not menus.
    `mobileCtaHref`: where the pill points on phones when `#kapote` (the ink band)
    is cut there — the expired deal page passes `#kapote-m`, its stacked form.
    Without it there is one pill, `#kapote`, at every width. */
export function Masthead({ mobileCtaHref }: { mobileCtaHref?: string } = {}) {
  const pill = (href: string, cls: string) => (
    <a href={href} className={cls}>
      <span className="bead bead--live" aria-hidden="true" />
      {S.ctaHeaderPill}
    </a>
  );
  return (
    <header className="v2-masthead">
      <div className="wrap bar">
        <Link href="/" className="v2-display logo" aria-label="Yip">yıp</Link>
        <nav className="navlinks d-only" aria-label={S.navAria}>
          <Link href="/">{S.navDeals}</Link>
          <Link href="/rinkiniai">{S.navCollections}</Link>
        </nav>
        <span className="v2-kicker v2-kicker--dim mid">{S.mastheadKicker}</span>
        {mobileCtaHref
          ? <>{pill('#kapote', 'pill d-only')}{pill(mobileCtaHref, 'pill m-only')}</>
          : pill('#kapote', 'pill')}
      </div>
    </header>
  );
}
