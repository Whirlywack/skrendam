'use client';
import { useState, useTransition } from 'react';
import { subscribeAction } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

/**
 * Mid-page capture — the ask right after the poster, so the moment of desire
 * and the form are never a full viewport apart (conversion audit 08-28).
 * The line states the selection base honestly: many routes watched, few pass.
 */
export function CaptureRow() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribeAction(data);
      if (res && res.ok) { setDone(true); setError(null); }
      else if (res && !res.ok) setError(res.error ?? S.genericError);
    });
  }

  return (
    <section className="wrap v2-capture">
      <div className="inner">
        <p className="line">{S.captureLine}</p>
        {done ? (
          <span className="ok">{S.captureOk}</span>
        ) : (
          <form onSubmit={onSubmit}>
            <input type="hidden" name="source" value="home-mid" />
            <input type="hidden" name="mode" value="inline" />
            <input
              type="email"
              name="email"
              placeholder={S.emailPlaceholder}
              aria-label={S.emailAria}
              required
            />
            <button type="submit" className="btn" disabled={pending}>
              {pending ? S.submitting : S.ctaSubmit}
            </button>
          </form>
        )}
        {error && <span role="alert">{error}</span>}
      </div>
    </section>
  );
}
