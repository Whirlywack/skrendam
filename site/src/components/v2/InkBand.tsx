'use client';
import { useState, useTransition } from 'react';
import { subscribeAction } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

/** The ink signup band — the page's one conversion, fed directly by the trophy case above it. */
export function InkBand() {
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
    <section className="v2-ink-band" id="kapote">
      <div className="sunball" aria-hidden="true" />
      <div className="wrap grid">
        {done ? (
          <div className="done" style={{ gridColumn: '1 / -1' }}>
            <h2 className="disp">{S.successTitle}</h2>
            <p className="body">{S.successSub}</p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="disp">{S.bandH2}</h2>
              <p className="body">{S.bandBody}</p>
            </div>
            <form onSubmit={onSubmit}>
              <input type="hidden" name="source" value="home" />
              <input type="hidden" name="mode" value="inline" />
              <div className="frow">
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
              </div>
              <label className="v2-early">
                <input type="checkbox" name="early_alerts" />
                <span><b>{S.earlyCheckbox}</b>{S.earlyCheckboxSub}</span>
              </label>
              {error && <div role="alert">{error}</div>}
              <div className="mono fine">{S.finePrint}</div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
