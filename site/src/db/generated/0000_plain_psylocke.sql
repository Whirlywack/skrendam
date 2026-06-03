-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "alembic_version" (
	"version_num" varchar(32) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"default_itinerary_tolerance" varchar NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "audience_segments_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"enabled" boolean NOT NULL,
	"audience_segment_id" integer NOT NULL,
	"travel_moment_id" integer NOT NULL,
	"priority" integer NOT NULL,
	"trip_type" varchar NOT NULL,
	"newsletter_tag" varchar,
	"public_label" varchar,
	"notes" text,
	"included_origins" json,
	"included_zones" json,
	"included_destinations" json,
	"excluded_destinations" json,
	"nearby_origins_allowed" boolean NOT NULL,
	"date_window_type" varchar NOT NULL,
	"rel_offset_start_days" integer,
	"rel_offset_end_days" integer,
	"season_start_mmdd" varchar,
	"season_end_mmdd" varchar,
	"fixed_start_date" date,
	"fixed_end_date" date,
	"preferred_departure_days" json,
	"preferred_return_days" json,
	"trip_len_min_days" integer,
	"trip_len_max_days" integer,
	"max_price_eur" double precision,
	"min_discount_pct" double precision,
	"min_abs_savings_eur" double precision,
	"psychological_price_threshold_eur" double precision,
	"allow_smaller_discount_if_under_price" boolean NOT NULL,
	"cabin" varchar NOT NULL,
	"max_stops" integer,
	"max_total_duration_minutes" integer,
	"max_layover_minutes" integer,
	"min_layover_minutes" integer,
	"allow_overnight_layover" boolean NOT NULL,
	"allow_airport_change" boolean NOT NULL,
	"allow_self_transfer" boolean NOT NULL,
	"allow_mixed_cabin" boolean NOT NULL,
	"prefer_direct" boolean NOT NULL,
	"family_friendly_times_only" boolean NOT NULL,
	"latest_arrival_hour" integer,
	"earliest_departure_hour" integer,
	"content_angle" text,
	"suggested_headline_template" text,
	"tiktok_hook_template" text,
	"newsletter_section" varchar,
	"publish_channel_default" varchar NOT NULL,
	"rules_json" json,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "deal_templates_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "travel_moments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"moment_type" varchar NOT NULL,
	"default_content_angle" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "travel_moments_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"zone" varchar PRIMARY KEY NOT NULL,
	"haul_type" varchar NOT NULL,
	"threshold_price_eur" double precision,
	"min_abs_savings_eur" double precision,
	"min_discount_pct" double precision,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"origin" varchar NOT NULL,
	"destination" varchar NOT NULL,
	"zone" varchar NOT NULL,
	"enabled" boolean NOT NULL,
	"cabin" varchar NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"route_id" integer NOT NULL,
	"origin" varchar NOT NULL,
	"destination" varchar NOT NULL,
	"zone" varchar NOT NULL,
	"trip_type" varchar NOT NULL,
	"travel_date" date NOT NULL,
	"return_date" date,
	"price" double precision NOT NULL,
	"currency" varchar NOT NULL,
	"baseline_price" double precision,
	"discount_pct" double precision,
	"itinerary_snapshot" json,
	"search_params" json,
	"status" varchar NOT NULL,
	"rejection_reason" text,
	"first_seen_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"scanner_version" varchar,
	"deal_group_key" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"scanner_version" varchar NOT NULL,
	"templates_scanned" integer NOT NULL,
	"routes_scanned" integer NOT NULL,
	"api_calls" integer NOT NULL,
	"http_429s" integer NOT NULL,
	"candidates_found" integer NOT NULL,
	"matches_created" integer NOT NULL,
	"errors" integer NOT NULL,
	"status" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"trip_type" varchar NOT NULL,
	"travel_date" date NOT NULL,
	"return_date" date,
	"price" double precision NOT NULL,
	"currency" varchar NOT NULL,
	"scanner_version" varchar NOT NULL,
	"scanned_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_template_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"deal_template_id" integer NOT NULL,
	"match_score" double precision NOT NULL,
	"reason_text" text,
	"gate_results" json,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"deal_template_id" integer NOT NULL,
	"content_draft_id" integer,
	"public_label" varchar,
	"newsletter_tag" varchar,
	"headline" text NOT NULL,
	"body" text,
	"tiktok_hook" text,
	"origin" varchar NOT NULL,
	"destination" varchar NOT NULL,
	"zone" varchar,
	"trip_type" varchar NOT NULL,
	"travel_date" date,
	"return_date" date,
	"price" double precision NOT NULL,
	"baseline_price" double precision,
	"discount_pct" double precision,
	"booking_url" text,
	"valid_until" date,
	"last_seen_at" timestamp,
	"tier" varchar NOT NULL,
	"status" varchar NOT NULL,
	"published_at" timestamp NOT NULL,
	"going_fast" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"deal_template_id" integer NOT NULL,
	"headline" text,
	"body" text,
	"tiktok_hook" text,
	"newsletter_snippet" text,
	"cta_text" text,
	"status" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"checked_at" timestamp NOT NULL,
	"provider" varchar NOT NULL,
	"price" double precision,
	"currency" varchar,
	"booking_url" text,
	"available" boolean NOT NULL,
	"notes" text,
	"raw_snapshot" json
);
--> statement-breakpoint
CREATE TABLE "scan_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar NOT NULL,
	"candidate_id" integer,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"requested_by" varchar DEFAULT 'curator' NOT NULL,
	"params" json,
	"result_summary" json,
	"error" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "deal_templates" ADD CONSTRAINT "deal_templates_audience_segment_id_fkey" FOREIGN KEY ("audience_segment_id") REFERENCES "public"."audience_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_templates" ADD CONSTRAINT "deal_templates_travel_moment_id_fkey" FOREIGN KEY ("travel_moment_id") REFERENCES "public"."travel_moments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_zone_fkey" FOREIGN KEY ("zone") REFERENCES "public"."zones"("zone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_log" ADD CONSTRAINT "price_log_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_log" ADD CONSTRAINT "price_log_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."scan_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_template_matches" ADD CONSTRAINT "candidate_template_matches_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_template_matches" ADD CONSTRAINT "candidate_template_matches_deal_template_id_fkey" FOREIGN KEY ("deal_template_id") REFERENCES "public"."deal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_deals" ADD CONSTRAINT "published_deals_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_deals" ADD CONSTRAINT "published_deals_content_draft_id_fkey" FOREIGN KEY ("content_draft_id") REFERENCES "public"."content_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_deals" ADD CONSTRAINT "published_deals_deal_template_id_fkey" FOREIGN KEY ("deal_template_id") REFERENCES "public"."deal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_deal_template_id_fkey" FOREIGN KEY ("deal_template_id") REFERENCES "public"."deal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_requests" ADD CONSTRAINT "scan_requests_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_routes_destination" ON "routes" USING btree ("destination" text_ops);--> statement-breakpoint
CREATE INDEX "ix_routes_origin" ON "routes" USING btree ("origin" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_candidates_deal_group_key" ON "candidates" USING btree ("deal_group_key" text_ops);--> statement-breakpoint
CREATE INDEX "ix_price_log_route_id" ON "price_log" USING btree ("route_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_price_log_scanned_at" ON "price_log" USING btree ("scanned_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ix_price_log_travel_date" ON "price_log" USING btree ("travel_date" date_ops);--> statement-breakpoint
CREATE INDEX "ix_candidate_template_matches_candidate_id" ON "candidate_template_matches" USING btree ("candidate_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_candidate_template_matches_deal_template_id" ON "candidate_template_matches" USING btree ("deal_template_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_content_drafts_candidate_id" ON "content_drafts" USING btree ("candidate_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_verification_checks_candidate_id" ON "verification_checks" USING btree ("candidate_id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_scan_requests_created_at" ON "scan_requests" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ix_scan_requests_status" ON "scan_requests" USING btree ("status" text_ops);
*/