import type { MetadataRoute } from 'next';
import { getLiveDeals } from '@/lib/queries';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  const deals = await getLiveDeals();
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    ...deals.map((r) => ({
      url: `${base}/deal/${r.pd.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
