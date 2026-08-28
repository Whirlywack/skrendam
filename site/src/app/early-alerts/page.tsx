import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { subscribePageAction } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

export const metadata: Metadata = {
  title: 'Skubios žinutės — rečiausi radiniai pirmam · Yip',
  description:
    'Dalis pigių skrydžių iš Vilniaus, Kauno ir Rygos dingsta dar prieš savaitinį laišką. Prisijunk prie skubių žinučių sąrašo — rečiausius radinius gausi vos tik juos randam.',
  alternates: { canonical: '/early-alerts' },
  openGraph: {
    title: 'Skubios žinutės — rečiausi radiniai pirmam · Yip',
    description: 'Rečiausi Baltijos radiniai — vos tik juos randam.',
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
        <div className="eyebrow">Skubios žinutės · renkam sąrašą</div>
        <h1 className="coll-h1">
          Gauk geriausius radinius <span style={{ color: 'var(--amber)' }}>pirmas</span>.
        </h1>
        <p className="lead">
          Dalis retų radinių dingsta dar prieš savaitinį laišką. Skubios žinutės atskrenda
          vos tik radinį randam — anksčiau nei laiškas, anksčiau nei jis dingsta.
        </p>
      </section>

      {/* ── FREE vs EARLY COMPARISON ─────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="cmp">

          {/* Free weekly — left column */}
          <div className="cmpcard">
            <span className="cmptag tag-now">Visada nemokama</span>
            <h3>Savaitinis laiškas</h3>
            <div className="cmp-price">Nemokamai</div>
            <ul className="cmplist">
              <li>
                <CheckIcon />
                Vienas ramus laiškas per savaitę
              </li>
              <li>
                <CheckIcon />
                Geriausi savaitės radiniai
              </li>
              <li className="cmp-dim">
                <ClockIcon />
                <span>Lėčiau — dalis retų radinių jau būna dingę</span>
              </li>
            </ul>
          </div>

          {/* Early alerts — right column (featured) */}
          <div className="cmpcard cmpcard--early">
            <span className="cmptag tag-wait">Renkam sąrašą</span>
            <h3>Skubios žinutės</h3>
            <div className="cmp-price">Nemokama · jau netrukus</div>
            <ul className="cmplist">
              <li>
                <ZapIcon />
                Rečiausi radiniai — <strong>vos tik juos randam</strong>
              </li>
              <li>
                <ZapIcon />
                Anksčiau nei savaitinis laiškas — kol dar neišpirkta
              </li>
              <li>
                <ZapIcon />
                Tavo oro uostai ir kelionių tipai — pirmiausia
              </li>
            </ul>

            {/* Join form — lives inside the early column */}
            <form
              action={subscribePageAction}
              className="ea-form"
              aria-label="Prisijungti prie skubių žinučių sąrašo"
            >
              <input type="hidden" name="mode" value="page" />
              <input type="hidden" name="early_alerts" value="on" />
              <input type="hidden" name="source" value="early" />
              <div className="ea-form-row">
                <input
                  type="email"
                  name="email"
                  placeholder={S.emailPlaceholder}
                  required
                  aria-label={S.emailAria}
                  autoComplete="email"
                />
                <button type="submit" className="btn">
                  Į skubių žinučių sąrašą
                </button>
              </div>
              <p className="ea-trust">Be spamo · atsisakai kada nori</p>
            </form>
          </div>
        </div>
      </section>

      {/* ── PREMIUM SOFT NOTE ────────────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <div className="ea-premium-note">
          <span className="cmptag tag-later" style={{ marginBottom: '10px', display: 'inline-block' }}>
            Vėliau
          </span>
          <p>
            Mokamas planas su pirkimu tiesiai iš pardavėjo ir žaibiškais kainos kritimo
            pranešimais — planuose, bet dar ne dabar. Kol kas skubios žinutės nemokamos.
          </p>
        </div>
      </section>

      {/* ── BACK TO FREE ─────────────────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }}>
        <Link href="/#capture" className="ea-back-link">
          Užtenka savaitinio laiško? Gauk radinius el. paštu →
        </Link>
      </section>

      <Footer />
    </main>
  );
}
