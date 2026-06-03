import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'),
  title: 'Yip — cheap flights from the Baltics, found and checked by hand',
  description: 'We find the best cheap flights from Vilnius, Kaunas, Riga and nearby — and tell you why each is good, and the catch.',
  openGraph: {
    title: 'Yip — cheap flights from the Baltics',
    description: 'Hand-checked flight deals from Vilnius, Kaunas, Riga and nearby. We tell you why each is good — and the catch.',
    type: 'website',
    siteName: 'Yip',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="yip-site">{children}</div>
      </body>
    </html>
  );
}
