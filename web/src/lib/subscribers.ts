import { and, eq, isNull } from 'drizzle-orm';
import { db, subscribers } from '@/db';

export type Plan = 'free' | 'paid';

export interface Recipient {
  id: number;
  email: string;
  plan: Plan;
  prefs: Record<string, unknown> | null;
  unsubscribeToken: string | null;
}

/** The only list a stream may draw recipients from: confirmed AND still
 *  subscribed AND on the requested plan. Mirrors `site/src/lib/subscribers.ts`
 *  with the plan split added — the instant stream and the digest go to
 *  `'paid'`, the nurture to `'free'`, never the other way round (spec §9).
 *  Returns the unsubscribe token because every send has to carry that
 *  recipient's `unsubscribeUrl`; rows without one are dropped by `sendable`. */
export async function activeSubscribers(plan: Plan): Promise<Recipient[]> {
  const rows = await db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      plan: subscribers.plan,
      prefs: subscribers.prefs,
      unsubscribeToken: subscribers.unsubscribeToken,
    })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.confirmed, true),
        isNull(subscribers.unsubscribedAt),
        eq(subscribers.plan, plan),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    plan,
    prefs: isRecord(r.prefs) ? r.prefs : null,
    unsubscribeToken: r.unsubscribeToken,
  }));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** No origin preference (prefs null, `origins` absent, empty or malformed)
 *  means "all origins"; otherwise the deal's origin must be listed. */
export function wantsOrigin(r: Recipient, origin: string): boolean {
  const origins = stringList(r.prefs?.origins);
  return origins.length === 0 || origins.includes(origin);
}

/** Moment codes the subscriber picked at signup (`prefs.moments`), [] if none. */
export function momentCodes(r: Recipient): string[] {
  return stringList(r.prefs?.moments);
}

/** A row may only be mailed when it has an address and an unsubscribe token —
 *  without the token there is no unsubscribe link, so no mail (skip + count). */
export function sendable(r: Recipient): boolean {
  return r.unsubscribeToken != null && r.unsubscribeToken !== '' && !!r.email;
}
