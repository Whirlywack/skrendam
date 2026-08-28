import type { PriceStats } from '@/lib/priceContext';
import { eur } from '@/lib/format';

export function PriceSparkline({ stats, todayPrice }: { stats: PriceStats; todayPrice: number }) {
  if (!stats.hasHistory) return null;
  const max = Math.max(...stats.series, todayPrice);
  const bars = stats.series.slice(-14);
  return (
    <div className="sec">
      <h3>Kodėl kaina gera</h3>
      <div className="bignote">Pigiausi {stats.percentile} % per 90 dienų šiame maršrute.</div>
      <div className="spark-wrap">
        <span className="nowtag">Šiandien {eur(todayPrice)}</span>
        <div className="spark">
          {bars.map((p, i) => (
            <i key={i} style={{ height: `${Math.round((p / max) * 100)}%` }} />
          ))}
          <i className="lo" style={{ height: `${Math.round((todayPrice / max) * 100)}%` }} />
        </div>
      </div>
      <div className="rangelbl">
        {/* "Best" appears only when today IS the best — a lower historical price
            under the live one argues against booking (journey audit 08-28). */}
        {todayPrice <= stats.low && <span>pigiausia, kokią matėm</span>}
        <span>90 d. įprasta <b>{eur(stats.median)}</b></span>
        <span>brangiausia <b>{eur(stats.high)}</b></span>
      </div>
    </div>
  );
}
