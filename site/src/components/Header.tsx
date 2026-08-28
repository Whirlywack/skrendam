import { S } from '@/lib/lt';

export function Header() {
  return (
    <header className="hdr">
      <span className="wm" aria-label="Yip">yıp</span>
      <nav aria-label={S.navAria}>
        <a href="/">{S.navDeals}</a>
        <a href="/collections">{S.navCollections}</a>
        {/* "Past fares" returns to the nav once real expired deals exist —
            a proof page with zero proof converts worse than no link (audit 08-28) */}
        <a href="/#how">{S.navHow}</a>
      </nav>
      <span className="sp" />
      <span className="frompill">{S.fromPill}</span>
    </header>
  );
}
