/**
 * DealTicket — boarding-pass ticket card.
 *
 * Two variants driven by the `featured` prop:
 *   - featured=false  → .deal  (vertical flex stack, 160px photo on top)
 *   - featured=true   → .feat  (2-col grid, photo left / body right)
 *
 * Both share the same child structure; the CSS (.deal vs .feat) handles the
 * layout difference.  The .ph class on the Photo wrapper is the direct grid /
 * flex child the CSS positions eyebrow + place overlays relative to.
 *
 * Source of truth: site/design-reference/homepage-v2.html
 * (.deal card at line 190; .feat card at line 179)
 */
import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { WAS_PRICE_MIN_DROP_PCT } from '@/lib/format-rules';
import { Photo } from './Photo';

export function DealTicket({ t, featured = false }: { t: TicketView; featured?: boolean }) {
  return (
    <Link
      href={`/deal/${t.id}`}
      className={featured ? 'feat' : 'deal'}
      aria-label={`${t.destination} from €${t.price}`}
    >
      {/* Photo panel — .ph makes it the positioned container for eyebrow + place overlays */}
      <Photo scene={t.scene} className="ph">
        {/* .ov: explicit gradient div (covers non-::after contexts; harmless alongside --protect) */}
        <div className="ov" />
        <span className="eyebrow">{t.eyebrow}</span>
        <div className="place">
          {t.destination}
          {/* .deal shows country + origin sub-line; .feat omits it (no <small> in feat mockup) */}
          {!featured && (
            <small>{t.country} · from {t.origin}</small>
          )}
        </div>
        {t.goingFast && <span className="hot-tag">&#x25B2; Going fast</span>}
      </Photo>

      {/* Card body */}
      <div className="body">
        <div className="meta">{t.route} · {t.dates} · {t.legs}</div>
        <h3>{t.headline}</h3>
        <div className="chips">
          {t.drop > 0 && <span className="chip chip-good">&#x2193; {t.drop}% under</span>}
          {t.catchChip && <span className="chip chip-caveat">{t.catchChip}</span>}
        </div>
        <div className="ticket-foot">
          <div className="price">
            €{t.price}
            {/* was-price only on deep deals — a strikethrough on a shallow
                discount spends trust for nothing (reference-price research) */}
            {t.baseline && t.drop >= WAS_PRICE_MIN_DROP_PCT ? <s>€{t.baseline}</s> : null}
            <span className="ret">return · {t.airline}</span>
          </div>
          <span className="btn-see">See deal &#x2192;</span>
        </div>
      </div>
    </Link>
  );
}
