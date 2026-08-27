'use client';
import { useState, useTransition } from 'react';
import { subscribeAction } from '@/app/subscribe-action';

export function CaptureBand() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribeAction(data);
      if (res && res.ok) {
        setDone(true);
        setError(null);
      } else if (res && !res.ok) {
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <div className="band" id="capture">
      <span className="bead" aria-hidden="true" />
      <div className="bcol">
        <h2>
          {done
            ? 'Almost there — confirm your email.'
            : 'Get the next rare fare before it sells out.'}
        </h2>
        <p>
          {done
            ? "We've emailed you a confirm link. Tap it and the weekly deals start landing."
            : 'Best rare fares in one calm weekly email. No spam, unsubscribe anytime.'}
        </p>
      </div>
      {!done && (
        <form className="f" onSubmit={onSubmit}>
          <input type="hidden" name="source" value="home" />
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
          {error && (
            <span role="alert" style={{ color: 'var(--amber-400, #EFA227)', fontSize: 12 }}>{error}</span>
          )}
        </form>
      )}
    </div>
  );
}
