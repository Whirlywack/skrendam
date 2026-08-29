import Link from 'next/link';
import { S } from '@/lib/lt';

export function V2Footer() {
  return (
    <footer className="v2-footer">
      <div className="wrap bar">
        <span className="v2-display" style={{ fontSize: 22 }} aria-label="Yip">yıp</span>
        <nav className="links" aria-label={S.navAria}>
          <Link href="/collections">{S.navAllDeals}</Link>
          <Link href="/pigus-skrydziai-is-vilniaus">{S.fromVilnius}</Link>
          <Link href="/pigus-skrydziai-is-kauno">{S.fromKaunas}</Link>
          <Link href="/pigus-skrydziai-is-rygos">{S.fromRiga}</Link>
          <Link href="/past-deals">{S.navPast}</Link>
        </nav>
        <span className="legal">© 2026 · {S.footerMade}</span>
      </div>
    </footer>
  );
}
