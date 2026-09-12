'use client';
import { useState, useTransition } from 'react';
import { subscribeAction } from '@/app/subscribe-action';
import { TrackingFields } from '@/components/TrackingFields';
import { S } from '@/lib/lt';

/**
 * Mobile-only stacked capture (PR B, DealExpiredMobile board): the form right
 * under the poster on an expired deal, where the ink band is cut. Same
 * behaviour as CaptureRow — the `source` is the signup attribution written
 * with the subscriber. `id="kapote-m"` is the target of the poster's mobile CTA.
 */
export function MobileCapture({ source = 'deal-mobile' }: { source?: string }) {
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
    <section className="wrap m-capture m-only" id="kapote-m">
      {done ? (
        <span className="ok">{S.successTitle}</span>
      ) : (
        <form onSubmit={onSubmit}>
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="mode" value="inline" />
          <TrackingFields />
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
      <div className="fine">{S.finePrint}</div>
    </section>
  );
}
