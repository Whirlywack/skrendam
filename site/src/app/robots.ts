import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      // Default: allow all content; disallow the state-changing / redirect-only
      // routes (not content): /confirm, the tracked /go links, the claim page.
      { userAgent: '*', allow: '/', disallow: ['/confirm', '/go/', '/uzsisakiau/'] },
      // Explicitly welcome AI answer engines (GEO) — do not block
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'ClaudeBot',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'Perplexity-User',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
          'Amazonbot',
        ],
        allow: '/',
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
