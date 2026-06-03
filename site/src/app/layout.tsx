import './globals.css';

export const metadata = {
  title: 'Yip — cheap flights from the Baltics, found and checked by hand',
  description: 'We find the best cheap flights from Vilnius, Kaunas, Riga and nearby — and tell you why each is good, and the catch.',
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
