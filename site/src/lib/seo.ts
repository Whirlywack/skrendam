/** Base URL helper — strips trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

// ── JSON-LD builders (pure, price-free) ──────────────────────────────────────

/** Organisation card for Yip. Logo omitted — no logo asset in /public. */
export function orgJsonLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Yip',
    url: base,
    description: 'Hand-checked cheap flights from Vilnius, Kaunas and Riga.',
    areaServed: 'Lithuania',
  };
}

/** WebSite card — no SearchAction (no site search). */
export function websiteJsonLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Yip',
    url: base,
  };
}

/** BreadcrumbList. Items are 1-based; `path` is resolved against siteUrl(). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: base + item.path,
    })),
  };
}

/** Price-free Article for a deal page. No Offer, no price, no priceCurrency. */
export function dealArticleJsonLd({
  id,
  headline,
  description,
  datePublished,
}: {
  id: number | string;
  headline: string;
  description: string;
  datePublished: string;
}) {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished,
    mainEntityOfPage: `${base}/deal/${id}`,
    publisher: {
      '@type': 'Organization',
      name: 'Yip',
    },
  };
}
