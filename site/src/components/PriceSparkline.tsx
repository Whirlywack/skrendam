import type { PriceStats } from '@/lib/priceContext';

export function PriceSparkline({ stats, todayPrice }: { stats: PriceStats; todayPrice: number }) {
  if (!stats.hasHistory) return null;
  const max = Math.max(...stats.series, todayPrice);
  const bars = stats.series.slice(-14);
  return (
    <div className="sec">
      <h3>Why it&apos;s a good deal</h3>
      <div className="bignote">Cheapest {stats.percentile}% we&apos;ve seen in 90 days.</div>
      <div className="spark-wrap">
        <span className="nowtag">Today &euro;{todayPrice}</span>
        <div className="spark">
          {bars.map((p, i) => (
            <i key={i} style={{ height: `${Math.round((p / max) * 100)}%` }} />
          ))}
          <i className="lo" style={{ height: `${Math.round((todayPrice / max) * 100)}%` }} />
        </div>
      </div>
      <div className="rangelbl">
        <span>best <b>&euro;{stats.low}</b></span>
        <span>typical <b>&euro;{stats.median}</b></span>
        <span>highest <b>&euro;{stats.high}</b></span>
      </div>
    </div>
  );
}
