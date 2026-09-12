import Link from 'next/link';
import { S } from '@/lib/lt';

export function V2Footer() {
  return (
    <footer className="v2-footer">
      <div className="wrap bar">
        <span className="v2-display" style={{ fontSize: 22 }} aria-label="Yip">yıp</span>
        <nav className="links d-only" aria-label={S.navAria}>
          <Link href="/rinkiniai">{S.navAllDeals}</Link>
          <Link href="/pigus-skrydziai-is-vilniaus">{S.fromVilnius}</Link>
          <Link href="/pigus-skrydziai-is-kauno">{S.fromKaunas}</Link>
          <Link href="/pigus-skrydziai-is-rygos">{S.fromRiga}</Link>
          <Link href="/buvo">{S.navPast}</Link>
          <Link href="/privatumas">{S.footerPrivacy}</Link>
        </nav>
        {/* phones: the six links go; the wordmark and „Privatumas" share one 52px row */}
        <Link href="/privatumas" className="legal m-only">{S.footerPrivacy}</Link>
        <span className="legal">© 2026 · {S.footerMade}</span>
      </div>
    </footer>
  );
}
