'use client';
import { useState, useTransition } from 'react';
import { subscribeAction, type SubscribeResult } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

interface SignupCardProps {
  /** Where the signup originates — stored in the DB; defaults to 'home'. */
  source?: string;
}

export function SignupCard({ source = 'home' }: SignupCardProps) {
  const [result, setResult] = useState<SubscribeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribeAction(data);
      if (res && res.ok) {
        setResult(res);
        setError(null);
      } else if (res && !res.ok) {
        setError(res.error ?? S.genericError);
      }
    });
  }

  const done = result?.ok === true;

  return (
    <div className="cap">
      <span className="freebadge">{S.freeBadge}</span>

      {done && result ? (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--sea-tint)',
                color: 'var(--sea-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="cap-lbl">
              {result.state === 'check-email' ? S.successTitle : S.subscribedTitle}
            </div>
          </div>
          <div className="cap-sub" style={{ marginTop: 6 }}>
            {result.state === 'check-email' ? S.successSub : S.subscribedSub}
          </div>
        </>
      ) : (
        <>
          <div className="cap-lbl">{S.capTitle}</div>
          <form id={`signup-card-${source}`} className="cap-row" onSubmit={onSubmit}>
            <input type="hidden" name="source" value={source} />
            <input type="hidden" name="mode" value="inline" />
            <input
              type="email"
              name="email"
              placeholder={S.emailPlaceholder}
              aria-label={S.emailAria}
              required
            />
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? S.submitting : S.ctaSubmit}
            </button>
          </form>
          {error && (
            <div role="alert" style={{ color: 'var(--coral-ink)', fontSize: 12, marginTop: 6 }}>
              {error}
            </div>
          )}
          <div className="cap-sub">{S.capSub}</div>
          <div className="trust">
            <span>✓ {S.trustNoSpam}</span>
            <span>✓ {S.trustUnsub}</span>
            <span>✓ {S.trustHuman}</span>
          </div>

          <div className="cap-div" />
          <label className="cap-early" style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              name="early_alerts"
              form={`signup-card-${source}`}
              style={{ marginTop: 3, accentColor: 'var(--sea-ink)' }}
            />
            <span>
              <span style={{ fontWeight: 700, fontSize: 13, display: 'block' }}>
                {S.earlyCheckbox}
              </span>
              <span className="cap-sub" style={{ marginTop: 1, display: 'block' }}>
                {S.earlyCheckboxSub}
              </span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}
