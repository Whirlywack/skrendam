import type { Metadata } from 'next';
import { Masthead } from '@/components/v2/Masthead';
import { V2Footer } from '@/components/v2/V2Footer';
import { S } from '@/lib/lt';

export const metadata: Metadata = {
  title: 'Prenumerata atšaukta · Yip',
  robots: { index: false, follow: false },
};

export default function Atsisakyta() {
  return (
    <main className="v2">
      <Masthead />
      <section className="wrap">
        <h1>{S.unsubscribedTitle}</h1>
        <p>{S.unsubscribedBody}</p>
      </section>
      <V2Footer />
    </main>
  );
}
