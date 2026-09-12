'use client';
import { TrackingFields } from '@/components/TrackingFields';
import { useSubscribeForm } from '@/components/v2/useSubscribeForm';
import { S } from '@/lib/lt';

/**
 * Mobile-only stacked capture (PR B, DealExpiredMobile board): the form right
 * under the poster on an expired deal, where the ink band is cut. Same
 * behaviour as CaptureRow — the `source` is the signup attribution written
 * with the subscriber (required, and it must be in SUBSCRIBE_SOURCES or the
 * action rewrites it to 'site'). `id="kapote-m"` is the target of the poster's
 * mobile CTA and of the masthead pill on the expired page.
 */
export function MobileCapture({ source }: { source: string }) {
  const { done, error, pending, onSubmit } = useSubscribeForm();

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
