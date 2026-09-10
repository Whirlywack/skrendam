import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { Masthead } from '@/components/v2/Masthead';
import { V2Footer } from '@/components/v2/V2Footer';
import { S } from '@/lib/lt';
import { isUnsubscribeToken } from '@/lib/unsubscribe';
import { unsubscribeAction } from './unsubscribe-action';

export const metadata: Metadata = {
  title: 'Atsisakyti laiškų · Yip',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Where the unsubscribe link in every marketing mail lands (see @/lib/unsubscribe).
 *
 *  A GET here changes nothing. Mail scanners (Outlook Safe Links, Gmail's link
 *  checker, corporate gateways) fetch every URL in an incoming mail, and when
 *  this was a state-changing GET each fetch was a real unsubscribe — followed
 *  30 days later by the purge of a subscriber who never clicked. The row flips
 *  only on the POST behind the button (`unsubscribeAction`).
 *
 *  Only a still-subscribed row gets the button: a second visit lands on /klaida
 *  with the "maybe you already left" copy, the same as a second click before. */
export default async function Atsisakyti({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : undefined;
  if (!isUnsubscribeToken(token)) redirect('/atsisakyti/klaida');

  const found = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)))
    .limit(1);
  if (found.length === 0) redirect('/atsisakyti/klaida');

  return (
    <main className="v2">
      <Masthead />
      <section className="wrap v2-unsub">
        <h1>{S.unsubscribeConfirmTitle}</h1>
        <p>{S.unsubscribeConfirmBody}</p>
        <form action={unsubscribeAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn">
            {S.unsubscribeConfirmCta}
          </button>
        </form>
      </section>
      <V2Footer />
    </main>
  );
}
