import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yip · Deal Desk',
  description: 'Internal curator admin for Yip flight deals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
