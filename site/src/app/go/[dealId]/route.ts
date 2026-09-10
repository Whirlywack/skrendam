import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals } from '@/db/generated/schema';
import { parseDealId, parseTracking, recordEvent } from '@/lib/events';
import { clickLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic'; // every hit is a redirect + a row, never cached

/** The tracked booking link in every deal mail: `/go/<dealId>?i=<issue>&s=<ref>`.
 *
 *  Records one `click` deal_event and 302s to the deal's booking URL (or to
 *  the on-site deal page when there is none). Any status counts — an expired
 *  deal still redirects, so an old mail never dead-ends on a 404.
 *
 *  This is the one GET on the site that writes a row (documented exception:
 *  a redirect cannot carry a button). Mail-scanner prefetches therefore show
 *  up as clicks; accepted noise. The write is best-effort: a DB failure is
 *  logged and the reader is still sent on their way. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ dealId: string }> }) {
  const { dealId: raw } = await ctx.params;
  const dealId = parseDealId(raw);
  if (dealId === null) return new NextResponse(null, { status: 404 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!clickLimiter.allow(`ip:${ip}`)) return new NextResponse(null, { status: 429 });

  const rows = await db
    .select({ bookingUrl: publishedDeals.bookingUrl })
    .from(publishedDeals)
    .where(eq(publishedDeals.id, dealId))
    .limit(1);
  if (rows.length === 0) return new NextResponse(null, { status: 404 });

  const { issueId, subscriberId } = parseTracking(req.nextUrl.searchParams);
  try {
    await recordEvent({
      dealId,
      issueId,
      subscriberId,
      kind: 'click',
      source: issueId !== null ? 'email' : null,
    });
  } catch (err) {
    console.error('[go] click not recorded', { dealId, issueId, subscriberId }, err);
  }

  const target = rows[0].bookingUrl ?? new URL(`/deal/${dealId}`, req.nextUrl.origin).toString();
  return NextResponse.redirect(target, 302);
}
