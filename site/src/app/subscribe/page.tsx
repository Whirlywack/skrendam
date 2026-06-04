import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  subscribePageAction,
  savePreferencesAction,
  joinEarlyAlertsAction,
} from '@/app/subscribe-action';
import { PREF_ORIGINS, PREF_MOMENTS } from '@/lib/subscribe-prefs';

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
      <h1 className="sub-h">Get hand-checked cheap flights by email.</h1>
      <p className="sub-body">
        A few genuinely good deals a week from Vilnius, Kaunas &amp; Riga —
        checked by a real person, the catch shown up front.
      </p>

      <form action={subscribePageAction}>
        <input type="hidden" name="source" value="subscribe" />
        <input type="hidden" name="mode" value="page" />

        <div className="sub-row">
          <input
            type="email"
            name="email"
            placeholder="you@email.com"
            aria-label="Email address"
            required
          />
          <button type="submit" className="sub-btn">
            Get free weekly deals
          </button>
        </div>

        <div className="sub-ea-row">
          <input type="checkbox" name="early_alerts" id="ea-idle" value="on" />
          <label htmlFor="ea-idle">Also get early alerts — rarest fares the moment we find them</label>
        </div>
      </form>

      <div className="sub-trust">
        <span>No spam</span>
        <span>Unsubscribe anytime</span>
        <span>Hand-checked fares</span>
      </div>

      <a href="/early-alerts" className="sub-ea-link">
        Want them sooner? Get early alerts →
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
        Almost there — check your inbox.
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5 }}>
        We&apos;ve sent a confirmation link to your email. Tap it and you&apos;re set.
      </p>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 10, lineHeight: 1.5 }}>
        Didn&apos;t get it? Check your spam folder, or{' '}
        <a href="/subscribe" className="sub-resend">
          try again with your email
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
        You&apos;re confirmed.
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
        First deals land in your inbox this week. Tell us what you&apos;re into — or skip.
      </p>

      {prefsSaved && (
        <div className="sub-saved" role="status">
          Preferences saved ✓
        </div>
      )}

      <form action={savePreferencesAction}>
        {/* Token is read from the httpOnly yip_pt cookie by the server action — not a form field. */}

        <p className="pref-lbl">Departing from</p>
        <div className="pref-chips" role="group" aria-label="Departure airports">
          {PREF_ORIGINS.map((o) => (
            <label key={o.code} className="pref-chip">
              <input type="checkbox" name="origins" value={o.code} />
              {o.label}
            </label>
          ))}
        </div>

        <p className="pref-lbl" style={{ marginTop: 13 }}>Trips you like</p>
        <div className="pref-chips" role="group" aria-label="Trip types">
          {PREF_MOMENTS.map((m) => (
            <label key={m.code} className="pref-chip">
              <input type="checkbox" name="moments" value={m.code} />
              {m.label}
            </label>
          ))}
        </div>

        <button type="submit" className="sub-btn" style={{ marginTop: 14, width: '100%', display: 'block' }}>
          Save
        </button>
      </form>

      <a
        href="/subscribe?state=upsell"
        className="sub-skip"
      >
        Skip — I&apos;ll take everything
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
          Preferences saved ✓
        </div>
      )}

      <span className="early-chip">Early alerts</span>
      <h2
        className="sub-h"
        style={{ textAlign: 'left', fontSize: 18, marginTop: 0 }}
      >
        Some fares are gone by the weekly email.
      </h2>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 6, lineHeight: 1.5 }}>
        Early alerts get you the rare ones first — the moment Yip finds them.
      </p>

      <form action={joinEarlyAlertsAction}>
        {/* Token is read from the httpOnly yip_pt cookie by the server action — not a form field. */}
        <button type="submit" className="sub-btn-sea">
          Join the early-alerts waitlist →
        </button>
      </form>

      <a href="/" className="sub-skip">
        Free weekly is plenty — no thanks
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
      <h1 className="sub-h">You&apos;re on the early-alerts list.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
        We&apos;ll ping you the moment we find a rare fare — before the weekly email.
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
        ← Back to deals
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
        {isInvalid ? 'Link expired or already used' : 'Something went wrong'}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', marginTop: 8, lineHeight: 1.5 }}>
        {isInvalid
          ? "This confirmation link has expired or has already been used. If you've confirmed your email, you're all set."
          : 'There was a problem — please try again.'}
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
        ← Try again
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — routes by searchParams.state
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'Subscribe — Yip cheap flights',
  description: 'Get hand-checked cheap flights from Vilnius, Kaunas and Riga by email, a few times a week.',
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
