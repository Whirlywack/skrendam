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
        <JsonLd data={orgJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
      </head>
      <body>
        <div className="yip-site">{children}</div>
      </body>
    </html>
  );
}
