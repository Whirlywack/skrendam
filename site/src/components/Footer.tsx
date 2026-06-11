/**
 * Footer — canonical ".ftr" footer with Deals / Yip / Follow columns.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 249–254)
 */
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr-in">
        {/* Brand column */}
        <div className="lead-col">
          <span className="wm">yıp</span>
          <p>
            Curated flight deals from Vilnius, Kaunas, Riga and nearby. We find
            the gems so you don&apos;t have to.
          </p>
        </div>

        {/* Deals column */}
        <div>
          <h4>Deals</h4>
          <Link href="/cheap-flights-from-vilnius">From Vilnius</Link>
          <Link href="/cheap-flights-from-kaunas">From Kaunas</Link>
          <Link href="/cheap-flights-from-riga">From Riga</Link>
          <Link href="/christmas-market-flights">Christmas markets</Link>
        </div>

        {/* Yip column */}
        <div>
          <h4>Yip</h4>
          <Link href="/past-deals">Past rare fares</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/early-alerts">Get early alerts</Link>
          <a href="mailto:hello@yip.lt">Contact</a>
        </div>

        {/* Follow column */}
        <div>
          <h4>Follow</h4>
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
        <span>© 2026 Yip. We link to airlines &amp; OTAs to book — prices change fast.</span>
        <span>Made in Vilnius 🇱🇹</span>
      </div>
    </footer>
  );
}
