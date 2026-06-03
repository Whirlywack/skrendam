import { pgTable, varchar, unique, serial, text, timestamp, foreignKey, boolean, integer, json, date, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const alembicVersion = pgTable("alembic_version", {
	versionNum: varchar("version_num", { length: 32 }).primaryKey().notNull(),
});

export const audienceSegments = pgTable("audience_segments", {
	id: serial().primaryKey().notNull(),
	slug: varchar().notNull(),
	name: varchar().notNull(),
	description: text(),
	defaultItineraryTolerance: varchar("default_itinerary_tolerance").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("audience_segments_slug_key").on(table.slug),
]);

export const dealTemplates = pgTable("deal_templates", {
	id: serial().primaryKey().notNull(),
	slug: varchar().notNull(),
	name: varchar().notNull(),
	enabled: boolean().notNull(),
	audienceSegmentId: integer("audience_segment_id").notNull(),
	travelMomentId: integer("travel_moment_id").notNull(),
	priority: integer().notNull(),
	tripType: varchar("trip_type").notNull(),
	newsletterTag: varchar("newsletter_tag"),
	publicLabel: varchar("public_label"),
	notes: text(),
	includedOrigins: json("included_origins"),
	includedZones: json("included_zones"),
	includedDestinations: json("included_destinations"),
	excludedDestinations: json("excluded_destinations"),
	nearbyOriginsAllowed: boolean("nearby_origins_allowed").notNull(),
	dateWindowType: varchar("date_window_type").notNull(),
	relOffsetStartDays: integer("rel_offset_start_days"),
	relOffsetEndDays: integer("rel_offset_end_days"),
	seasonStartMmdd: varchar("season_start_mmdd"),
	seasonEndMmdd: varchar("season_end_mmdd"),
	fixedStartDate: date("fixed_start_date"),
	fixedEndDate: date("fixed_end_date"),
	preferredDepartureDays: json("preferred_departure_days"),
	preferredReturnDays: json("preferred_return_days"),
	tripLenMinDays: integer("trip_len_min_days"),
	tripLenMaxDays: integer("trip_len_max_days"),
	maxPriceEur: doublePrecision("max_price_eur"),
	minDiscountPct: doublePrecision("min_discount_pct"),
	minAbsSavingsEur: doublePrecision("min_abs_savings_eur"),
	psychologicalPriceThresholdEur: doublePrecision("psychological_price_threshold_eur"),
	allowSmallerDiscountIfUnderPrice: boolean("allow_smaller_discount_if_under_price").notNull(),
	cabin: varchar().notNull(),
	maxStops: integer("max_stops"),
	maxTotalDurationMinutes: integer("max_total_duration_minutes"),
	maxLayoverMinutes: integer("max_layover_minutes"),
	minLayoverMinutes: integer("min_layover_minutes"),
	allowOvernightLayover: boolean("allow_overnight_layover").notNull(),
	allowAirportChange: boolean("allow_airport_change").notNull(),
	allowSelfTransfer: boolean("allow_self_transfer").notNull(),
	allowMixedCabin: boolean("allow_mixed_cabin").notNull(),
	preferDirect: boolean("prefer_direct").notNull(),
	familyFriendlyTimesOnly: boolean("family_friendly_times_only").notNull(),
	latestArrivalHour: integer("latest_arrival_hour"),
	earliestDepartureHour: integer("earliest_departure_hour"),
	contentAngle: text("content_angle"),
	suggestedHeadlineTemplate: text("suggested_headline_template"),
	tiktokHookTemplate: text("tiktok_hook_template"),
	newsletterSection: varchar("newsletter_section"),
	publishChannelDefault: varchar("publish_channel_default").notNull(),
	rulesJson: json("rules_json"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.audienceSegmentId],
			foreignColumns: [audienceSegments.id],
			name: "deal_templates_audience_segment_id_fkey"
		}),
	foreignKey({
			columns: [table.travelMomentId],
			foreignColumns: [travelMoments.id],
			name: "deal_templates_travel_moment_id_fkey"
		}),
	unique("deal_templates_slug_key").on(table.slug),
]);

export const travelMoments = pgTable("travel_moments", {
	id: serial().primaryKey().notNull(),
	slug: varchar().notNull(),
	name: varchar().notNull(),
	description: text(),
	momentType: varchar("moment_type").notNull(),
	defaultContentAngle: text("default_content_angle"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("travel_moments_slug_key").on(table.slug),
]);

export const zones = pgTable("zones", {
	zone: varchar().primaryKey().notNull(),
	haulType: varchar("haul_type").notNull(),
	thresholdPriceEur: doublePrecision("threshold_price_eur"),
	minAbsSavingsEur: doublePrecision("min_abs_savings_eur"),
	minDiscountPct: doublePrecision("min_discount_pct"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
});

export const routes = pgTable("routes", {
	id: serial().primaryKey().notNull(),
	origin: varchar().notNull(),
	destination: varchar().notNull(),
	zone: varchar().notNull(),
	enabled: boolean().notNull(),
	cabin: varchar().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("ix_routes_destination").using("btree", table.destination.asc().nullsLast().op("text_ops")),
	index("ix_routes_origin").using("btree", table.origin.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.zone],
			foreignColumns: [zones.zone],
			name: "routes_zone_fkey"
		}),
]);

export const candidates = pgTable("candidates", {
	id: serial().primaryKey().notNull(),
	runId: integer("run_id"),
	routeId: integer("route_id").notNull(),
	origin: varchar().notNull(),
	destination: varchar().notNull(),
	zone: varchar().notNull(),
	tripType: varchar("trip_type").notNull(),
	travelDate: date("travel_date").notNull(),
	returnDate: date("return_date"),
	price: doublePrecision().notNull(),
	currency: varchar().notNull(),
	baselinePrice: doublePrecision("baseline_price"),
	discountPct: doublePrecision("discount_pct"),
	itinerarySnapshot: json("itinerary_snapshot"),
	searchParams: json("search_params"),
	status: varchar().notNull(),
	rejectionReason: text("rejection_reason"),
	firstSeenAt: timestamp("first_seen_at", { mode: 'string' }).notNull(),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }).notNull(),
	verifiedAt: timestamp("verified_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	scannerVersion: varchar("scanner_version"),
	dealGroupKey: varchar("deal_group_key").notNull(),
}, (table) => [
	uniqueIndex("ix_candidates_deal_group_key").using("btree", table.dealGroupKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.routeId],
			foreignColumns: [routes.id],
			name: "candidates_route_id_fkey"
		}),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [scanRuns.id],
			name: "candidates_run_id_fkey"
		}),
]);

export const scanRuns = pgTable("scan_runs", {
	id: serial().primaryKey().notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).notNull(),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
	scannerVersion: varchar("scanner_version").notNull(),
	templatesScanned: integer("templates_scanned").notNull(),
	routesScanned: integer("routes_scanned").notNull(),
	apiCalls: integer("api_calls").notNull(),
	http429S: integer("http_429s").notNull(),
	candidatesFound: integer("candidates_found").notNull(),
	matchesCreated: integer("matches_created").notNull(),
	errors: integer().notNull(),
	status: varchar().notNull(),
});

export const priceLog = pgTable("price_log", {
	id: serial().primaryKey().notNull(),
	runId: integer("run_id").notNull(),
	routeId: integer("route_id").notNull(),
	tripType: varchar("trip_type").notNull(),
	travelDate: date("travel_date").notNull(),
	returnDate: date("return_date"),
	price: doublePrecision().notNull(),
	currency: varchar().notNull(),
	scannerVersion: varchar("scanner_version").notNull(),
	scannedAt: timestamp("scanned_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("ix_price_log_route_id").using("btree", table.routeId.asc().nullsLast().op("int4_ops")),
	index("ix_price_log_scanned_at").using("btree", table.scannedAt.asc().nullsLast().op("timestamp_ops")),
	index("ix_price_log_travel_date").using("btree", table.travelDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.routeId],
			foreignColumns: [routes.id],
			name: "price_log_route_id_fkey"
		}),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [scanRuns.id],
			name: "price_log_run_id_fkey"
		}),
]);

export const candidateTemplateMatches = pgTable("candidate_template_matches", {
	id: serial().primaryKey().notNull(),
	candidateId: integer("candidate_id").notNull(),
	dealTemplateId: integer("deal_template_id").notNull(),
	matchScore: doublePrecision("match_score").notNull(),
	reasonText: text("reason_text"),
	gateResults: json("gate_results"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("ix_candidate_template_matches_candidate_id").using("btree", table.candidateId.asc().nullsLast().op("int4_ops")),
	index("ix_candidate_template_matches_deal_template_id").using("btree", table.dealTemplateId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [candidates.id],
			name: "candidate_template_matches_candidate_id_fkey"
		}),
	foreignKey({
			columns: [table.dealTemplateId],
			foreignColumns: [dealTemplates.id],
			name: "candidate_template_matches_deal_template_id_fkey"
		}),
]);

export const publishedDeals = pgTable("published_deals", {
	id: serial().primaryKey().notNull(),
	candidateId: integer("candidate_id").notNull(),
	dealTemplateId: integer("deal_template_id").notNull(),
	contentDraftId: integer("content_draft_id"),
	publicLabel: varchar("public_label"),
	newsletterTag: varchar("newsletter_tag"),
	headline: text().notNull(),
	body: text(),
	tiktokHook: text("tiktok_hook"),
	origin: varchar().notNull(),
	destination: varchar().notNull(),
	zone: varchar(),
	tripType: varchar("trip_type").notNull(),
	travelDate: date("travel_date"),
	returnDate: date("return_date"),
	price: doublePrecision().notNull(),
	baselinePrice: doublePrecision("baseline_price"),
	discountPct: doublePrecision("discount_pct"),
	bookingUrl: text("booking_url"),
	validUntil: date("valid_until"),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }),
	tier: varchar().notNull(),
	status: varchar().notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }).notNull(),
	goingFast: boolean("going_fast").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [candidates.id],
			name: "published_deals_candidate_id_fkey"
		}),
	foreignKey({
			columns: [table.contentDraftId],
			foreignColumns: [contentDrafts.id],
			name: "published_deals_content_draft_id_fkey"
		}),
	foreignKey({
			columns: [table.dealTemplateId],
			foreignColumns: [dealTemplates.id],
			name: "published_deals_deal_template_id_fkey"
		}),
]);

export const contentDrafts = pgTable("content_drafts", {
	id: serial().primaryKey().notNull(),
	candidateId: integer("candidate_id").notNull(),
	dealTemplateId: integer("deal_template_id").notNull(),
	headline: text(),
	body: text(),
	tiktokHook: text("tiktok_hook"),
	newsletterSnippet: text("newsletter_snippet"),
	ctaText: text("cta_text"),
	status: varchar().notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("ix_content_drafts_candidate_id").using("btree", table.candidateId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [candidates.id],
			name: "content_drafts_candidate_id_fkey"
		}),
	foreignKey({
			columns: [table.dealTemplateId],
			foreignColumns: [dealTemplates.id],
			name: "content_drafts_deal_template_id_fkey"
		}),
]);

export const verificationChecks = pgTable("verification_checks", {
	id: serial().primaryKey().notNull(),
	candidateId: integer("candidate_id").notNull(),
	checkedAt: timestamp("checked_at", { mode: 'string' }).notNull(),
	provider: varchar().notNull(),
	price: doublePrecision(),
	currency: varchar(),
	bookingUrl: text("booking_url"),
	available: boolean().notNull(),
	notes: text(),
	rawSnapshot: json("raw_snapshot"),
}, (table) => [
	index("ix_verification_checks_candidate_id").using("btree", table.candidateId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [candidates.id],
			name: "verification_checks_candidate_id_fkey"
		}),
]);

export const scanRequests = pgTable("scan_requests", {
	id: serial().primaryKey().notNull(),
	kind: varchar().notNull(),
	candidateId: integer("candidate_id"),
	status: varchar().default('queued').notNull(),
	requestedBy: varchar("requested_by").default('curator').notNull(),
	params: json(),
	resultSummary: json("result_summary"),
	error: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
}, (table) => [
	index("ix_scan_requests_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("ix_scan_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [candidates.id],
			name: "scan_requests_candidate_id_fkey"
		}),
]);
