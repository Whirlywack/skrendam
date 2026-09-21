'use client';
import { TrackingFields } from '@/components/TrackingFields';
import { useSubscribeForm } from '@/components/v2/useSubscribeForm';
import { S } from '@/lib/lt';

/** The ink signup band — the page's one conversion, fed directly by the trophy case above it.
 *  `source` is the signup attribution written with the subscriber ('home' | 'deal' | …). */
export function InkBand({ source = 'home' }: { source?: string }) {
  const { done, error, pending, onSubmit } = useSubscribeForm();

  return (
    <section className="v2-ink-band" id="kapote">
      <div className="sunball" aria-hidden="true" />
      <div className="wrap grid">
        {done ? (
          <div className="done" style={{ gridColumn: '1 / -1' }}>
            <h2 className="v2-display">{S.successTitle}</h2>
            <p className="body">{S.successSub}</p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="v2-display">{S.bandH2}</h2>
              <p className="body">{S.bandBody}</p>
            </div>
            {/* Field + button + fine print only — the early-alerts offer moved to
                the post-confirmation upsell (conversion audit 08-28: no second
                decision at the moment of the first). */}
            <form onSubmit={onSubmit}>
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="mode" value="inline" />
              <TrackingFields />
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
              {error && <div role="alert">{error}</div>}
              <div className="fine">{S.finePrint}</div>
              {/* The site's strongest objection-killer, re-homed from the deleted
                  FAQ (review 08-28): we never touch your money. */}
              <div className="fine">{S.trustDirect}</div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
