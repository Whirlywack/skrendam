import type { PriceStats } from '@/lib/priceContext';
import { eur } from '@/lib/format';

/** V2 price-history bars — no card, no header: the page supplies the claim.
    Bars sit directly on the paper; today is the amber bead's color. */
export function PriceSparkline({ stats, todayPrice }: { stats: PriceStats; todayPrice: number }) {
  if (!stats.hasHistory) return null;
  const max = Math.max(...stats.series, todayPrice);
  const bars = stats.series.slice(-14);
  return (
    <div className="v2-spark">
      <div className="bars" aria-hidden="true">
        {bars.map((p, i) => (
          <i key={i} style={{ height: `${Math.round((p / max) * 100)}%` }} />
        ))}
        <i className="today" style={{ height: `${Math.round((todayPrice / max) * 100)}%` }} />
      </div>
      <div className="mono lbls">
        {/* "Best" appears only when today IS the best — a lower historical price
            under the live one argues against booking (journey audit 08-28). */}
        {todayPrice <= stats.low && <span>pigiausia, kokią matėm</span>}
        <span>šiandien <b>{eur(todayPrice)}</b></span>
        <span>90 d. įprasta <b>{eur(stats.median)}</b></span>
        <span>brangiausia <b>{eur(stats.high)}</b></span>
      </div>
    </div>
  );
}
