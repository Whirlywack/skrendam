import type { CandidateView } from './types';

// Date-clone collapse (deal-detection synthesis §ranking): the scan produces
// the same route cheap across many adjacent travel dates. One representative
// row per route+price-cluster; the twins sit one click away. Without this a
// single route's 30 dates bury every other deal in the group.
export interface Cluster {
  rep: CandidateView;
  rest: CandidateView[];
}

export function clusterByRoute(candidates: CandidateView[]): Cluster[] {
  const map = new Map<string, Cluster>();
  const order: string[] = [];
  for (const c of candidates) {
    // Same route + within ±15% of the representative's price = a date-clone.
    const routeKey = `${c.from}-${c.to}-${c.status}`;
    const existing = map.get(routeKey);
    if (existing && Math.abs(c.price - existing.rep.price) / existing.rep.price <= 0.15) {
      existing.rest.push(c);
    } else if (!existing) {
      map.set(routeKey, { rep: c, rest: [] });
      order.push(routeKey);
    } else {
      // Distinct price band on the same route — its own visible cluster.
      const altKey = `${routeKey}-€${Math.round(c.price / 25)}`;
      const alt = map.get(altKey);
      if (alt) alt.rest.push(c);
      else {
        map.set(altKey, { rep: c, rest: [] });
        order.push(altKey);
      }
    }
  }
  return order.map((k) => map.get(k)!);
}

export function clusterDateSpan(cluster: Cluster): string {
  const dates = [cluster.rep, ...cluster.rest].map((c) => c.travelDate).sort();
  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}
