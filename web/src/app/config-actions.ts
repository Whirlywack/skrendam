'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { dealTemplates, zones, audienceSegments, travelMoments, routes } from '@/db/generated/schema';

// ---------------------------------------------------------------------------
// Auth guard — re-checked inside EVERY action.
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const numOrNull = (v: FormDataEntryValue | null): number | null => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : Number(s);
};

const strOrNull = (v: FormDataEntryValue | null): string | null => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
};

// ---------------------------------------------------------------------------
// ZONES — PK is the zone string; threshold/min_* are nullable.
// NOT-NULL columns: zone, haulType, updatedAt
// ---------------------------------------------------------------------------
export async function upsertZone(form: FormData): Promise<void> {
  await requireAdmin();
  const zone = (form.get('zone') ?? '').toString().trim();
  if (!zone) throw new Error('zone is required');

  const now = new Date().toISOString();
  const editableValues = {
    haulType: (form.get('haul_type') ?? 'short').toString(),
    thresholdPriceEur: numOrNull(form.get('threshold_price_eur')),
    minAbsSavingsEur: numOrNull(form.get('min_abs_savings_eur')),
    minDiscountPct: numOrNull(form.get('min_discount_pct')),
  };

  const updated = await db
    .update(zones)
    .set({ ...editableValues, updatedAt: now })
    .where(eq(zones.zone, zone))
    .returning({ z: zones.zone });

  if (updated.length === 0) {
    // INSERT: must supply all NOT-NULL columns (haulType, updatedAt)
    await db.insert(zones).values({
      zone,
      ...editableValues,
      updatedAt: now,
    });
  }

  revalidatePath('/config/zones');
}

// ---------------------------------------------------------------------------
// ROUTES — origin, destination, zone, enabled, cabin, createdAt, updatedAt all notNull.
// ---------------------------------------------------------------------------
export async function upsertRoute(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const now = new Date().toISOString();

  const editableValues = {
    origin: (form.get('origin') ?? '').toString().trim().toUpperCase(),
    destination: (form.get('destination') ?? '').toString().trim().toUpperCase(),
    zone: (form.get('zone') ?? '').toString().trim(),
    cabin: (form.get('cabin') ?? 'ECONOMY').toString(),
  };

  if (!editableValues.origin || !editableValues.destination || !editableValues.zone) {
    throw new Error('origin, destination, zone required');
  }

  if (id !== null) {
    await db
      .update(routes)
      .set({ ...editableValues, updatedAt: now })
      .where(eq(routes.id, id));
  } else {
    // INSERT: must supply all NOT-NULL columns (origin, destination, zone, enabled, cabin, createdAt, updatedAt)
    await db.insert(routes).values({
      ...editableValues,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/config/routes');
}

export async function toggleRouteEnabled(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get('id'));
  const enabled = form.get('enabled') === 'true';
  await db.update(routes).set({ enabled: !enabled }).where(eq(routes.id, id));
  revalidatePath('/config/routes');
}

// ---------------------------------------------------------------------------
// TEMPLATES — many NOT-NULL boolean columns + createdAt/updatedAt.
// ---------------------------------------------------------------------------
export async function toggleTemplateEnabled(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get('id'));
  const enabled = form.get('enabled') === 'true';
  await db.update(dealTemplates).set({ enabled: !enabled }).where(eq(dealTemplates.id, id));
  revalidatePath('/config/templates');
}

export async function upsertDealTemplate(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const now = new Date().toISOString();

  const editableValues = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    audienceSegmentId: Number(form.get('audience_segment_id')),
    travelMomentId: Number(form.get('travel_moment_id')),
    tripType: (form.get('trip_type') ?? 'roundtrip').toString(),
    priority: numOrNull(form.get('priority')) ?? 0,
    publicLabel: strOrNull(form.get('public_label')),
    newsletterTag: strOrNull(form.get('newsletter_tag')),
    // "what's cheap" — the tuning knobs
    maxPriceEur: numOrNull(form.get('max_price_eur')),
    minDiscountPct: numOrNull(form.get('min_discount_pct')),
    psychologicalPriceThresholdEur: numOrNull(form.get('psychological_price_threshold_eur')),
    minAbsSavingsEur: numOrNull(form.get('min_abs_savings_eur')),
    // "itinerary pain"
    maxStops: numOrNull(form.get('max_stops')),
    maxTotalDurationMinutes: numOrNull(form.get('max_total_duration_minutes')),
    // "content angle"
    contentAngle: strOrNull(form.get('content_angle')),
    suggestedHeadlineTemplate: strOrNull(form.get('suggested_headline_template')),
    tiktokHookTemplate: strOrNull(form.get('tiktok_hook_template')),
  };

  if (!editableValues.slug || !editableValues.name) throw new Error('slug + name required');

  if (id !== null) {
    await db
      .update(dealTemplates)
      .set({ ...editableValues, updatedAt: now })
      .where(eq(dealTemplates.id, id));
  } else {
    // INSERT: must supply ALL NOT-NULL columns.
    // Booleans that are NOT-NULL but not editable in this form default to Python model values:
    //   enabled (true), nearbyOriginsAllowed (false), allowSmallerDiscountIfUnderPrice (false),
    //   allowOvernightLayover (true), allowAirportChange (true), allowSelfTransfer (true),
    //   allowMixedCabin (true), preferDirect (false), familyFriendlyTimesOnly (false)
    // Also: cabin ('ECONOMY'), dateWindowType ('relative'), publishChannelDefault ('public')
    await db.insert(dealTemplates).values({
      ...editableValues,
      // NOT-NULL booleans with Python-model defaults
      enabled: true,
      nearbyOriginsAllowed: false,
      allowSmallerDiscountIfUnderPrice: false,
      allowOvernightLayover: true,
      allowAirportChange: true,
      allowSelfTransfer: true,
      allowMixedCabin: true,
      preferDirect: false,
      familyFriendlyTimesOnly: false,
      // NOT-NULL strings with Python-model defaults
      cabin: 'ECONOMY',
      dateWindowType: 'relative',
      publishChannelDefault: 'public',
      // timestamps
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/config/templates');
}

// ---------------------------------------------------------------------------
// AUDIENCES — slug, name, defaultItineraryTolerance, createdAt, updatedAt all notNull.
// ---------------------------------------------------------------------------
export async function upsertAudience(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const now = new Date().toISOString();

  const editableValues = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    description: strOrNull(form.get('description')),
    defaultItineraryTolerance: (form.get('default_itinerary_tolerance') ?? 'normal').toString(),
  };

  if (!editableValues.slug || !editableValues.name) throw new Error('slug + name required');

  if (id !== null) {
    await db
      .update(audienceSegments)
      .set({ ...editableValues, updatedAt: now })
      .where(eq(audienceSegments.id, id));
  } else {
    // INSERT: must supply all NOT-NULL columns (slug, name, defaultItineraryTolerance, createdAt, updatedAt)
    await db.insert(audienceSegments).values({
      ...editableValues,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/config/audiences');
}

// ---------------------------------------------------------------------------
// MOMENTS — slug, name, momentType, createdAt, updatedAt all notNull.
// ---------------------------------------------------------------------------
export async function upsertMoment(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const now = new Date().toISOString();

  const editableValues = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    description: strOrNull(form.get('description')),
    momentType: (form.get('moment_type') ?? 'relative').toString(),
    defaultContentAngle: strOrNull(form.get('default_content_angle')),
  };

  if (!editableValues.slug || !editableValues.name) throw new Error('slug + name required');

  if (id !== null) {
    await db
      .update(travelMoments)
      .set({ ...editableValues, updatedAt: now })
      .where(eq(travelMoments.id, id));
  } else {
    // INSERT: must supply all NOT-NULL columns (slug, name, momentType, createdAt, updatedAt)
    await db.insert(travelMoments).values({
      ...editableValues,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/config/moments');
}
