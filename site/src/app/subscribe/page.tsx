import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  subscribePageAction,
  savePreferencesAction,
  joinEarlyAlertsAction,
} from '@/app/subscribe-action';
import { PREF_ORIGINS, PREF_MOMENTS } from '@/lib/subscribe-prefs';
import { S } from '@/lib/lt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  searchParams: Promise<{ state?: string }>;
};

// ---------------------------------------------------------------------------
// Sub-components (server, no 'use client' needed)
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// State: idle — standalone capture card (entry B)
// ---------------------------------------------------------------------------

function IdleState() {
  return (
    <div className="sub-card" style={{ textAlign: 'center' }}>
      <div className="sub-wm">yıp</div>
      <h1 className="sub-h">{S.ctaBandFull}.</h1>
      <p className="sub-body">
        Keli tikrai geri radiniai per savaitę iš Vilniaus, Kauno ir Rygos —
        patikrinti gyvo žmogaus, kabliukas parodytas iš karto.
      </p>

      <form action={subscribePageAction}>
        <input type="hidden" name="source" value="subscribe" />
        <input type="hidden" name="mode" value="page" />

        <div className="sub-row">
          <input
            type="email"
            name="email"
            placeholder={S.emailPlaceholder}
            aria-label={S.emailAria}
            required
          />
          <button type="submit" className="sub-btn">
            {S.ctaSubmit}
          </button>
        </div>

        <div className="sub-ea-row">
          <input type="checkbox" name="early_alerts" id="ea-idle" value="on" />
          <label htmlFor="ea-idle">{S.earlyCheckbox}</label>
        </div>
      </form>

      <div className="sub-trust">
        <span>{S.trustNoSpam}</span>
        <span>{S.trustUnsub}</span>
        <span>{S.trustHuman}</span>
      </div>

      <a href="/early-alerts" className="sub-ea-link">
        Nori anksčiau? Skubios žinutės →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State: check-email
// ---------------------------------------------------------------------------

function CheckEmailState() {
  return (
    <div className="sub-card">
      <div className="sub-ok">
        <EnvelopeIcon />
      </div>
      <h1 className="sub-h" style={{ textAlign: 'left' }}>
        {S.successTitle}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5 }}>
        {S.successSub}
      </p>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 10, lineHeight: 1.5 }}>
        Negavai? Patikrink šlamšto aplanką arba{' '}
        <a href="/subscribe" className="sub-resend">
          pabandyk dar kartą
        </a>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State: confirmed + prefs-saved — show preferences form + (optionally) saved note
// ---------------------------------------------------------------------------

function ConfirmedState({ prefsSaved }: { prefsSaved: boolean }) {
  return (
    <div className="sub-card">
      <div className="sub-ok">
        <CheckIcon />
      </div>
      <h1 className="sub-h" style={{ textAlign: 'left' }}>
        {S.subscribedTitle}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
        {S.subscribedSub} Papasakok, kas tave domina — arba praleisk.
      </p>

      {prefsSaved && (
        <div className="sub-saved" role="status">
          Išsaugota ✓
        </div>
      )}

      <form action={savePreferencesAction}>
        {/* Token is read from the httpOnly yip_pt cookie by the server action — not a form field. */}

        <p className="pref-lbl">Iš kur skrendi</p>
        <div className="pref-chips" role="group" aria-label="Išvykimo oro uostai">
          {PREF_ORIGINS.map((o) => (
            <label key={o.code} className="pref-chip">
              <input type="checkbox" name="origins" value={o.code} />
              {o.label}
            </label>
          ))}
        </div>

        <p className="pref-lbl" style={{ marginTop: 13 }}>Kokios kelionės domina</p>
        <div className="pref-chips" role="group" aria-label="Kelionių tipai">
          {PREF_MOMENTS.map((m) => (
            <label key={m.code} className="pref-chip">
              <input type="checkbox" name="moments" value={m.code} />
              {m.label}
            </label>
          ))}
        </div>

        <button type="submit" className="sub-btn" style={{ marginTop: 14, width: '100%', display: 'block' }}>
          Išsaugoti
        </button>
      </form>

      <a
        href="/subscribe?state=upsell"
        className="sub-skip"
      >
        Praleisk — noriu visų radinių
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State: upsell — soft early-alerts ask
// ---------------------------------------------------------------------------

function UpsellState({ prefsSaved }: { prefsSaved: boolean }) {
  return (
    <div className="sub-card">
      {prefsSaved && (
        <div className="sub-saved" role="status" style={{ marginBottom: 12 }}>
          Išsaugota ✓
        </div>
      )}

      <span className="early-chip">Skubios žinutės</span>
      <h2
        className="sub-h"
        style={{ textAlign: 'left', fontSize: 18, marginTop: 0 }}
      >
        Dalis radinių dingsta dar prieš savaitinį laišką.
      </h2>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 6, lineHeight: 1.5 }}>
        {S.earlyCheckboxSub}
      </p>

      <form action={joinEarlyAlertsAction}>
        {/* Token is read from the httpOnly yip_pt cookie by the server action — not a form field. */}
        <button type="submit" className="sub-btn-sea">
          Į skubių žinučių sąrašą →
        </button>
      </form>

      <a href="/" className="sub-skip">
        Užteks savaitinio laiško — ačiū, ne
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State: early-joined
// ---------------------------------------------------------------------------

function EarlyJoinedState() {
  return (
    <div className="sub-card sub-joined">
      <div className="sub-ok" style={{ margin: '0 auto 12px' }}>
        <CheckIcon />
      </div>
      <h1 className="sub-h">Tu skubių žinučių sąraše.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
        Parašysim vos radę retą radinį — dar prieš savaitinį laišką.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 18,
          color: 'var(--sea-ink)',
          fontWeight: 700,
          fontSize: 13.5,
          textDecoration: 'none',
        }}
      >
        ← Grįžti prie radinių
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State: invalid / error
// ---------------------------------------------------------------------------

function ErrorState({ isInvalid }: { isInvalid: boolean }) {
  return (
    <div className="sub-card" style={{ textAlign: 'center' }}>
      <h1 className="sub-h">
        {isInvalid ? 'Nuoroda nebegalioja arba jau panaudota' : 'Kažkas nepavyko'}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5 }}>
        {isInvalid
          ? 'Ši patvirtinimo nuoroda nebegalioja arba jau panaudota. Jei el. paštą jau patvirtinai — viskas gerai.'
          : S.genericError}
      </p>
      <a
        href="/subscribe"
        style={{
          display: 'inline-block',
          marginTop: 18,
          color: 'var(--sea-ink)',
          fontWeight: 700,
          fontSize: 13.5,
          textDecoration: 'none',
        }}
      >
        ← Bandyti dar kartą
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — routes by searchParams.state
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Prenumerata — Yip radiniai el. paštu',
  description: 'Gauk žmogaus patikrintus pigius skrydžius iš Vilniaus, Kauno ir Rygos el. paštu — kelis kartus per savaitę.',
};

export default async function SubscribePage({ searchParams }: PageProps) {
  const { state } = await searchParams;

  let content: React.ReactNode;

  switch (state) {
    case 'check-email':
      content = <CheckEmailState />;
      break;

    case 'confirmed':
      content = <ConfirmedState prefsSaved={false} />;
      break;

    case 'prefs-saved':
      // Show upsell after saving prefs (prefs form → upsell)
      content = <UpsellState prefsSaved={true} />;
      break;

    case 'upsell':
      content = <UpsellState prefsSaved={false} />;
      break;

    case 'early-joined':
      content = <EarlyJoinedState />;
      break;

    case 'invalid':
    case 'expired':
      content = <ErrorState isInvalid={true} />;
      break;

    case 'error':
      content = <ErrorState isInvalid={false} />;
      break;

    default:
      content = <IdleState />;
  }

  return (
    <>
      <Header />
      <main className="sub-page">
        {content}
      </main>
      <Footer />
    </>
  );
}
