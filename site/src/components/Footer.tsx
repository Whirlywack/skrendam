/**
 * Footer — canonical ".ftr" footer with Deals / Yip / Follow columns.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 249–254)
 */
import Link from 'next/link';
import { S } from '@/lib/lt';

export function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr-in">
        {/* Brand column */}
        <div className="lead-col">
          <span className="wm" aria-label="Yip">yıp</span>
          <p>{S.footerLead}</p>
        </div>

        {/* Deals column */}
        <div>
          <h4>{S.navDeals}</h4>
          <Link href="/pigus-skrydziai-is-vilniaus">{S.fromVilnius}</Link>
          <Link href="/pigus-skrydziai-is-kauno">{S.fromKaunas}</Link>
          <Link href="/pigus-skrydziai-is-rygos">{S.fromRiga}</Link>
          <Link href="/christmas-market-flights">{S.footerXmas}</Link>
        </div>

        {/* Yip column */}
        <div>
          <h4>Yip</h4>
          {/* "Past rare fares" returns once real expired deals exist (audit 08-28) */}
          {/* /#how anchor died with the V1 homepage; link returns with PR C's page */}
          <Link href="/early-alerts">{S.footerEarly}</Link>
          <a href="mailto:hello@yip.lt">{S.footerContact}</a>
        </div>

        {/* Follow column */}
        <div>
          <h4>{S.footerFollow}</h4>
          <a href="https://tiktok.com/@yipfares" target="_blank" rel="noopener noreferrer">
            TikTok
          </a>
          <a href="https://instagram.com/yipfares" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href="https://t.me/yipfares" target="_blank" rel="noopener noreferrer">
            Telegram
          </a>
        </div>
      </div>

      <div className="legal">
        <span>{S.footerLegal}</span>
        <span>{S.footerMade} 🇱🇹</span>
      </div>
    </footer>
  );
}
