'use client';
import { useState, useTransition } from 'react';
import { subscribeAction, type SubscribeResult } from '@/app/subscribe-action';

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
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  const done = result?.ok === true;

  return (
    <div className="cap">
      <span className="freebadge">Free</span>

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
            <div className="cap-lbl">You&apos;re in.</div>
          </div>
          <div className="cap-sub" style={{ marginTop: 6 }}>
            {result.state === 'check-email'
              ? "You're in — check your email to confirm."
              : 'First deals land in your inbox this week.'}
          </div>

          <div className="cap-div" />
          <div className="cap-early">
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Want them sooner?</div>
              <div className="cap-sub" style={{ marginTop: 1 }}>
                The rarest fares as soon as Yip finds them — before the weekly email.
              </div>
            </div>
            <a href="/early-alerts" className="btn-sec">Get early alerts →</a>
          </div>
        </>
      ) : (
        <>
          <div className="cap-lbl">Get the next rare fare by email</div>
          <form className="cap-row" onSubmit={onSubmit}>
            <input type="hidden" name="source" value={source} />
            <input type="hidden" name="mode" value="inline" />
            <input
              type="email"
              name="email"
              placeholder="you@email.com"
              aria-label="Email address"
              required
            />
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Adding…' : 'Get free weekly deals'}
            </button>
          </form>
          {error && (
            <div role="alert" style={{ color: 'var(--coral-ink)', fontSize: 12, marginTop: 6 }}>
              {error}
            </div>
          )}
          <div className="cap-sub">Best rare fares in one calm weekly email.</div>
          <div className="trust">
            <span>✓ No spam</span>
            <span>✓ Unsubscribe anytime</span>
            <span>✓ Hand-checked fares</span>
          </div>

          <div className="cap-div" />
          <div className="cap-early">
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Want them sooner?</div>
              <div className="cap-sub" style={{ marginTop: 1 }}>
                The best fares as soon as Yip finds them — before the weekly email.
              </div>
            </div>
            <a href="/early-alerts" className="btn-sec">Get early alerts →</a>
          </div>
        </>
      )}
    </div>
  );
}
