import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals } from '@/db/generated/schema';
import { Masthead } from '@/components/v2/Masthead';
import { V2Footer } from '@/components/v2/V2Footer';
import { S } from '@/lib/lt';
import { parseDealId } from '@/lib/events';
import { claimAction, priceChangedAction } from './claim-action';

export const metadata: Metadata = {
  title: 'Užsisakei? · Yip',
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/** Where the „Užsisakiau" link in every deal mail lands:
 *  `/uzsisakiau/<dealId>?i=<issue>&s=<ref>`.
 *
 *  A GET here changes nothing — the same reason as /atsisakyti: mail scanners
 *  fetch every link, and a claim on prefetch would inflate the one number we
 *  promise is real. The `booked_claim` row is written only by the POST behind
 *  the button (`claimAction`); `i` and `s` ride along as hidden fields.
 *
 *  Any deal that exists gets the button, expired ones included — a reader
 *  booking on the last day and clicking a week later should still count.
 *
 *  A second button, „Kaina pasikeitė" (WP9), is the reader's price signal:
 *  same hidden fields, its own action, a `price_changed` row, the same
 *  done state. */
export default async function Uzsisakiau({ params, searchParams }: PageProps) {
  const [{ dealId: raw }, sp] = await Promise.all([params, searchParams]);
  const dealId = parseDealId(raw);

  const found =
    dealId === null
      ? []
      : await db
          .select({ id: publishedDeals.id })
          .from(publishedDeals)
          .where(eq(publishedDeals.id, dealId))
          .limit(1);

  let body: React.ReactNode;
  if (found.length === 0) {
    body = <h1>{S.claimInvalid}</h1>;
  } else if (one(sp.done) === '1') {
    body = <h1>{S.claimDone}</h1>;
  } else if (one(sp.error) === '1') {
    body = (
      <>
        <h1>{S.claimTitle}</h1>
        <p role="alert">{S.genericError}</p>
      </>
    );
  } else {
    body = (
      <>
        <h1>{S.claimTitle}</h1>
        <p>{S.claimBody}</p>
        <form action={claimAction}>
          <input type="hidden" name="dealId" value={String(dealId)} />
          {one(sp.i) && <input type="hidden" name="i" value={one(sp.i)} />}
          {one(sp.s) && <input type="hidden" name="s" value={one(sp.s)} />}
          <button type="submit" className="btn">
            {S.claimCta}
          </button>
        </form>
        <form action={priceChangedAction}>
          <input type="hidden" name="dealId" value={String(dealId)} />
          {one(sp.i) && <input type="hidden" name="i" value={one(sp.i)} />}
          {one(sp.s) && <input type="hidden" name="s" value={one(sp.s)} />}
          <button type="submit" className="btn">
            {S.priceChangedCta}
          </button>
        </form>
      </>
    );
  }

  return (
    <main className="v2">
      <Masthead />
      <section className="wrap v2-claim">{body}</section>
      <V2Footer />
    </main>
  );
}
