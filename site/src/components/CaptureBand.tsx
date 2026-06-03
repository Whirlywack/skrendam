'use client';
import { useState, useTransition } from 'react';
import { subscribe } from '@/app/subscribe-action';

export function CaptureBand() {
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
      <div>
        <h3>{done ? "You're in — check your inbox." : 'Never miss a rare fare.'}</h3>
        <p>
          {done
            ? "We'll send the best deals in one calm weekly email."
            : 'The best deals go in one calm weekly email. No spam, unsubscribe anytime.'}
        </p>
      </div>
      {!done && (
        <form className="capform" onSubmit={onSubmit}>
          <input
            type="email"
            name="email"
            placeholder="you@email.com"
            aria-label="Email address"
            required
          />
          <button type="submit" className="capbtn" disabled={pending}>
            {pending ? 'Adding…' : 'Get deals'}
          </button>
          {error && (
            <span role="alert" style={{ color: 'var(--coral-600)', fontSize: 12 }}>{error}</span>
          )}
        </form>
      )}
    </div>
  );
}
