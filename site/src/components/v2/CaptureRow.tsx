'use client';
import { TrackingFields } from '@/components/TrackingFields';
import { useSubscribeForm } from '@/components/v2/useSubscribeForm';
import { S } from '@/lib/lt';

/**
 * Mid-page capture — the ask right after the poster, so the moment of desire
 * and the form are never a full viewport apart (conversion audit 08-28).
 * The line states the selection base honestly: many routes watched, few pass.
 */
export function CaptureRow({ source = 'home-mid' }: { source?: string }) {
  const { done, error, pending, onSubmit } = useSubscribeForm();

  return (
    <section className="wrap v2-capture">
      <div className="inner">
        <p className="line">{S.captureLine}</p>
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
      </div>
    </section>
  );
}
