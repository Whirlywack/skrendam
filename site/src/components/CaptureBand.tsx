'use client';
import { useState, useTransition } from 'react';
import { subscribeAction } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

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
        setError(res.error ?? S.genericError);
      }
    });
  }

  return (
    <div className="band" id="capture">
      <span className="bead" aria-hidden="true" />
      <div className="bcol">
        <h2>{done ? S.successTitle : S.bandH2}</h2>
        <p>{done ? S.successSub : S.bandBody}</p>
      </div>
      {!done && (
        <form className="f" onSubmit={onSubmit}>
          <input type="hidden" name="source" value="home" />
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
          {error && (
            <span role="alert" style={{ color: 'var(--amber-400, #EFA227)', fontSize: 12 }}>{error}</span>
          )}
        </form>
      )}
    </div>
  );
}
