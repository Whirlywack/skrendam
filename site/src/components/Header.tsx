import { S } from '@/lib/lt';

export function Header() {
  return (
    <header className="hdr">
      <span className="wm" aria-label="Yip">yıp</span>
      <nav aria-label={S.navAria}>
        <a href="/">{S.navDeals}</a>
        <a href="/collections">{S.navCollections}</a>
        {/* "Kaip tai veikia" returns when the V2 how-it-works page exists (PR C) —
            its old /#how anchor died with the V1 homepage (review 08-28) */}
      </nav>
      <span className="sp" />
      <span className="frompill">{S.fromPill}</span>
    </header>
  );
}
