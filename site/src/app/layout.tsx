import type { Metadata } from 'next';
import './globals.css';
import { JsonLd } from '@/components/JsonLd';
import { orgJsonLd, websiteJsonLd, siteUrl } from '@/lib/seo';
import { S } from '@/lib/lt';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: S.metaTitle,
  description: S.metaDescription,
  openGraph: {
    title: S.ogTitle,
    description: S.ogDescription,
    type: 'website',
    siteName: 'Yip',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <head>
        {/* Brand fonts must load from here: a nested CSS @import is silently
            stripped by the bundler (2026-08-28 audit — the site had rendered
            system fallbacks in production). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:ital,wght@0,400..800;1,400..600&family=Space+Mono:wght@400;700&display=swap"
        />
        <JsonLd data={orgJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </head>
      <body>
        <div className="yip-site">{children}</div>
      </body>
    </html>
  );
}
