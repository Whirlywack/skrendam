import { and, asc, eq, gte } from 'drizzle-orm';
import { priceLog, routes } from '@/db/generated/schema';

export interface PriceStats { hasHistory: boolean; low: number; median: number; high: number; percentile: number | null; series: number[]; }
const MIN_SAMPLES = 14;
const WINDOW_DAYS = 90;

export function priceStats(prices: number[], dealPrice: number): PriceStats {
  const clean = prices.filter((p) => p > 0);
  if (clean.length < MIN_SAMPLES)
    return { hasHistory: false, low: dealPrice, median: dealPrice, high: dealPrice, percentile: null, series: clean };
  const sorted = [...clean].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const belowOrEqual = sorted.filter((p) => p <= dealPrice).length;
  return {
    hasHistory: true, low: sorted[0], high: sorted[sorted.length - 1], median,
    percentile: Math.max(1, Math.round((belowOrEqual / sorted.length) * 100)),
    series: clean,
  };
}

export async function priceContext(origin: string, destination: string, tripType: string,
                                   dealPrice: number, now: Date): Promise<PriceStats> {
  // Lazy import keeps the Neon client out of module-init (safe for unit tests).
  const { db } = await import('@/db');
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const rows = await db
    .select({ price: priceLog.price, scannedAt: priceLog.scannedAt })
    .from(priceLog)
    .innerJoin(routes, eq(priceLog.routeId, routes.id))
    .where(and(eq(routes.origin, origin), eq(routes.destination, destination),
               eq(priceLog.tripType, tripType), gte(priceLog.scannedAt, since)))
    .orderBy(asc(priceLog.scannedAt));
  return priceStats(rows.map((r) => Number(r.price)), dealPrice);
}
