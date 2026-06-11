import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { subscribePageAction } from '@/app/subscribe-action';

export const metadata: Metadata = {
  title: 'Early alerts — get the rare fares first · Yip',
  description:
    'Some cheap flights from Vilnius, Kaunas & Riga sell out before the weekly email. Join the early-alerts waitlist to get the rarest fares the moment Yip finds them.',
  alternates: { canonical: '/early-alerts' },
  openGraph: {
    title: 'Early alerts — get the rare fares first · Yip',
    description: 'Get the rarest Baltic flight deals the moment we find them.',
  },
};

// SVG icons (inline, Lucide-style, matching the mockup)
function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

export default function EarlyAlertsPage() {
  return (
    <main className="yip-site yip-early">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="pad">
        <div className="eyebrow">Early alerts · waitlist</div>
        <h1 className="coll-h1">
          Get the best fares <span style={{ color: 'var(--amber)' }}>first</span>.
        </h1>
        <p className="lead">
          Some rare fares are gone by the time the weekly email goes out. Early alerts send them
          the moment Yip finds them — before the email, before they sell out.
        </p>
      </section>

      {/* ── FREE vs EARLY COMPARISON ─────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="cmp">

          {/* Free weekly — left column */}
          <div className="cmpcard">
            <span className="cmptag tag-now">You&rsquo;re on this</span>
            <h3>Free weekly email</h3>
            <div className="cmp-price">Always free</div>
            <ul className="cmplist">
              <li>
                <CheckIcon />
                One calm email a week
              </li>
              <li>
                <CheckIcon />
                The best of what we found that week
              </li>
              <li className="cmp-dim">
                <ClockIcon />
                <span>Slower — some rare fares may be gone</span>
              </li>
            </ul>
          </div>

          {/* Early alerts — right column (featured) */}
          <div className="cmpcard cmpcard--early">
            <span className="cmptag tag-wait">Waitlist</span>
            <h3>Early alerts</h3>
            <div className="cmp-price">Free to join · coming soon</div>
            <ul className="cmplist">
              <li>
                <ZapIcon />
                The rarest fares <strong>the moment we find them</strong>
              </li>
              <li>
                <ZapIcon />
                Before the weekly email — before they sell out
              </li>
              <li>
                <ZapIcon />
                Your airports &amp; trip types, prioritised
              </li>
            </ul>

            {/* Join form — lives inside the early column */}
            <form
              action={subscribePageAction}
              className="ea-form"
              aria-label="Join the early-alerts waitlist"
            >
              <input type="hidden" name="mode" value="page" />
              <input type="hidden" name="early_alerts" value="on" />
              <input type="hidden" name="source" value="early" />
              <div className="ea-form-row">
                <input
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  required
                  aria-label="Email address"
                  autoComplete="email"
                />
                <button type="submit" className="btn">
                  Join the early-alerts waitlist
                </button>
              </div>
              <p className="ea-trust">No spam · Unsubscribe anytime</p>
            </form>
          </div>
        </div>
      </section>

      {/* ── PREMIUM SOFT NOTE ────────────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="ea-premium-note">
          <span className="cmptag tag-later" style={{ marginBottom: '10px', display: 'inline-block' }}>
            Later
          </span>
          <p>
            A premium tier with vendor-direct booking and instant price-drop alerts is on the
            roadmap — not yet. For now, early alerts are free to join.
          </p>
        </div>
      </section>

      {/* ── BACK TO FREE ─────────────────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <Link href="/#capture" className="ea-back-link">
          Just want the weekly email? Get free weekly deals →
        </Link>
      </section>

      <Footer />
    </main>
  );
}
