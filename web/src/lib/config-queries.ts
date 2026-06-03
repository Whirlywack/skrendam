import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { dealTemplates, zones, audienceSegments, travelMoments, routes } from '@/db/generated/schema';

export const listTemplates = () =>
  db.select().from(dealTemplates).orderBy(asc(dealTemplates.priority), asc(dealTemplates.name));

export const listZones = () =>
  db.select().from(zones).orderBy(asc(zones.zone));

export const listAudiences = () =>
  db.select().from(audienceSegments).orderBy(asc(audienceSegments.slug));

export const listMoments = () =>
  db.select().from(travelMoments).orderBy(asc(travelMoments.slug));

export const listRoutes = () =>
  db.select().from(routes).orderBy(asc(routes.origin), asc(routes.destination));
