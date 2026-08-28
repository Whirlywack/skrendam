import Link from 'next/link';
import { S } from '@/lib/lt';

/** Sticky V2 masthead — the amber pill is the page's persistent capture CTA
    (founder call 08-28: the CTA must be unmissable). Nav is deliberately two
    links: the homepage is the catalog, /collections is the only hub (IA
    decision 08-28) — origin pages live in footer/crumbs/link bands, not menus. */
export function Masthead() {
  return (
    <header className="v2-masthead">
      <div className="wrap bar">
        <Link href="/" className="v2-display logo" aria-label="Yip">yıp</Link>
        <nav className="navlinks" aria-label={S.navAria}>
          <Link href="/">{S.navDeals}</Link>
          <Link href="/collections">{S.navCollections}</Link>
        </nav>
        <span className="v2-kicker v2-kicker--dim mid">{S.mastheadKicker}</span>
        <a href="#kapote" className="pill">
          <span className="bead bead--live" aria-hidden="true" />
          {S.ctaHeaderPill}
        </a>
      </div>
    </header>
  );
}
