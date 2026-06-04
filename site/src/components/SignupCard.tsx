'use client';
import { useState, useTransition } from 'react';
import { subscribe } from '@/app/subscribe-action';

export function SignupCard() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribe(data);
      if (res.ok) {
        setDone(true);
        setError(null);
      } else {
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <div className="cap">
      <span className="freebadge">Free</span>

      {done ? (
        <div className="cap-lbl">You&apos;re in — first deals land this week.</div>
      ) : (
        <>
          <div className="cap-lbl">Get the next rare fare by email</div>
          <form className="cap-row" onSubmit={onSubmit}>
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
        </>
      )}

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
    </div>
  );
}
