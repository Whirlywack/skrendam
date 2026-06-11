import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { COLLECTIONS } from '@/lib/collections';
import { getLiveDeals } from '@/lib/queries';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes = ['', '/collections', '/past-deals', '/subscribe', '/early-alerts'].map(
    (p) => ({
      url: base + (p || '/'),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: p === '' ? 1 : 0.7,
    }),
  );

  const collectionRoutes = COLLECTIONS.map((c) => ({
    url: `${base}/${c.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  let dealRoutes: MetadataRoute.Sitemap = [];
  try {
    const live = await getLiveDeals(); // LIVE only — expired deals are noindex; exclude them
    dealRoutes = live.map((r) => {
      // lastSeenAt and publishedAt are mode:'string' timestamps — coerce to Date
      const rawModified = r.pd.lastSeenAt ?? r.pd.publishedAt;
      const lastModified = rawModified ? new Date(rawModified) : now;
      return {
        url: `${base}/deal/${r.pd.id}`,
        lastModified,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      };
    });
  } catch {
    // Never let a DB hiccup 500 the sitemap — return static + collection routes only
    dealRoutes = [];
  }

  return [...staticRoutes, ...collectionRoutes, ...dealRoutes];
}
