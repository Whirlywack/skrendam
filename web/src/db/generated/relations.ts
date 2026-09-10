import { relations } from "drizzle-orm/relations";
import { audienceSegments, dealTemplates, travelMoments, zones, routes, candidates, scanRuns, priceLog, candidateTemplateMatches, publishedDeals, contentDrafts, verificationChecks, scanRequests, candidateScores, dealEvents, issues, subscribers } from "./schema";

export const dealTemplatesRelations = relations(dealTemplates, ({one, many}) => ({
	audienceSegment: one(audienceSegments, {
		fields: [dealTemplates.audienceSegmentId],
		references: [audienceSegments.id]
	}),
	travelMoment: one(travelMoments, {
		fields: [dealTemplates.travelMomentId],
		references: [travelMoments.id]
	}),
	candidateTemplateMatches: many(candidateTemplateMatches),
	publishedDeals: many(publishedDeals),
	contentDrafts: many(contentDrafts),
	candidateScores: many(candidateScores),
}));

export const audienceSegmentsRelations = relations(audienceSegments, ({many}) => ({
	dealTemplates: many(dealTemplates),
}));

export const travelMomentsRelations = relations(travelMoments, ({many}) => ({
	dealTemplates: many(dealTemplates),
}));

export const routesRelations = relations(routes, ({one, many}) => ({
	zone: one(zones, {
		fields: [routes.zone],
		references: [zones.zone]
	}),
	candidates: many(candidates),
	priceLogs: many(priceLog),
}));

export const zonesRelations = relations(zones, ({many}) => ({
	routes: many(routes),
}));

export const candidatesRelations = relations(candidates, ({one, many}) => ({
	route: one(routes, {
		fields: [candidates.routeId],
		references: [routes.id]
	}),
	scanRun: one(scanRuns, {
		fields: [candidates.runId],
		references: [scanRuns.id]
	}),
	candidateTemplateMatches: many(candidateTemplateMatches),
	publishedDeals: many(publishedDeals),
	contentDrafts: many(contentDrafts),
	verificationChecks: many(verificationChecks),
	scanRequests: many(scanRequests),
	candidateScores: many(candidateScores),
}));

export const scanRunsRelations = relations(scanRuns, ({many}) => ({
	candidates: many(candidates),
	priceLogs: many(priceLog),
}));

export const priceLogRelations = relations(priceLog, ({one}) => ({
	route: one(routes, {
		fields: [priceLog.routeId],
		references: [routes.id]
	}),
	scanRun: one(scanRuns, {
		fields: [priceLog.runId],
		references: [scanRuns.id]
	}),
}));

export const candidateTemplateMatchesRelations = relations(candidateTemplateMatches, ({one}) => ({
	candidate: one(candidates, {
		fields: [candidateTemplateMatches.candidateId],
		references: [candidates.id]
	}),
	dealTemplate: one(dealTemplates, {
		fields: [candidateTemplateMatches.dealTemplateId],
		references: [dealTemplates.id]
	}),
}));

export const publishedDealsRelations = relations(publishedDeals, ({one, many}) => ({
	candidate: one(candidates, {
		fields: [publishedDeals.candidateId],
		references: [candidates.id]
	}),
	contentDraft: one(contentDrafts, {
		fields: [publishedDeals.contentDraftId],
		references: [contentDrafts.id]
	}),
	dealTemplate: one(dealTemplates, {
		fields: [publishedDeals.dealTemplateId],
		references: [dealTemplates.id]
	}),
	dealEvents: many(dealEvents),
}));

export const contentDraftsRelations = relations(contentDrafts, ({one, many}) => ({
	publishedDeals: many(publishedDeals),
	candidate: one(candidates, {
		fields: [contentDrafts.candidateId],
		references: [candidates.id]
	}),
	dealTemplate: one(dealTemplates, {
		fields: [contentDrafts.dealTemplateId],
		references: [dealTemplates.id]
	}),
}));

export const verificationChecksRelations = relations(verificationChecks, ({one}) => ({
	candidate: one(candidates, {
		fields: [verificationChecks.candidateId],
		references: [candidates.id]
	}),
}));

export const scanRequestsRelations = relations(scanRequests, ({one}) => ({
	candidate: one(candidates, {
		fields: [scanRequests.candidateId],
		references: [candidates.id]
	}),
}));

export const candidateScoresRelations = relations(candidateScores, ({one}) => ({
	candidate: one(candidates, {
		fields: [candidateScores.candidateId],
		references: [candidates.id]
	}),
	dealTemplate: one(dealTemplates, {
		fields: [candidateScores.dealTemplateId],
		references: [dealTemplates.id]
	}),
}));

export const dealEventsRelations = relations(dealEvents, ({one}) => ({
	publishedDeal: one(publishedDeals, {
		fields: [dealEvents.dealId],
		references: [publishedDeals.id]
	}),
	issue: one(issues, {
		fields: [dealEvents.issueId],
		references: [issues.id]
	}),
	subscriber: one(subscribers, {
		fields: [dealEvents.subscriberId],
		references: [subscribers.id]
	}),
}));

export const issuesRelations = relations(issues, ({many}) => ({
	dealEvents: many(dealEvents),
}));

export const subscribersRelations = relations(subscribers, ({many}) => ({
	dealEvents: many(dealEvents),
}));