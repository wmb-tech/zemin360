CREATE TYPE "public"."approval_status" AS ENUM('proposed', 'approved', 'edited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."collaboration_status" AS ENUM('introduced', 'meeting', 'started', 'ongoing', 'completed', 'did_not_happen');--> statement-breakpoint
CREATE TYPE "public"."collaboration_type" AS ENUM('internship', 'project', 'part_time', 'full_time', 'pilot_customer', 'co_founder', 'mentor');--> statement-breakpoint
CREATE TYPE "public"."evidence_level" AS ENUM('verified', 'documented', 'referenced', 'declared');--> statement-breakpoint
CREATE TYPE "public"."evidence_source_kind" AS ENUM('github_repo', 'live_url', 'document', 'network_reference', 'challenge_submission');--> statement-breakpoint
CREATE TYPE "public"."match_strength" AS ENUM('strong', 'possible', 'weak');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('talent', 'organization', 'operator');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('remote', 'onsite', 'hybrid');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"input_summary" jsonb,
	"output_summary" jsonb,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"cost_usd" text,
	"human_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'proposed' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"edited_payload" jsonb,
	"agent_run_id" uuid,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"text" text NOT NULL,
	"level" "evidence_level" NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"period_start" date,
	"period_end" date,
	"approved" boolean DEFAULT false NOT NULL,
	"draft_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"status" "collaboration_status" DEFAULT 'introduced' NOT NULL,
	"last_checkin_at" timestamp with time zone,
	"talent_feedback" text,
	"organization_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborations_match_id_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"signals" jsonb NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"kind" "evidence_source_kind" NOT NULL,
	"ref" text NOT NULL,
	"ownership_verified" boolean DEFAULT false NOT NULL,
	"ownership_method" text,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid NOT NULL,
	"talent_id" uuid NOT NULL,
	"strength" "match_strength" NOT NULL,
	"reasoning" jsonb NOT NULL,
	"rank" integer NOT NULL,
	"introduced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"card" jsonb,
	"card_status" "card_status" DEFAULT 'draft' NOT NULL,
	"card_approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"city" text,
	"approved_by_operator_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "talents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" text,
	"story" text,
	"city" text,
	"birth_year" integer,
	"card_status" "card_status" DEFAULT 'draft' NOT NULL,
	"card_approved_at" timestamp with time zone,
	"public_slug" text,
	"last_signal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talents_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "talents_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"github_id" text,
	"github_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_claims" ADD CONSTRAINT "card_claims_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_signals" ADD CONSTRAINT "evidence_signals_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talents" ADD CONSTRAINT "talents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_queue_status_idx" ON "approval_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "card_claims_talent_idx" ON "card_claims" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "evidence_signals_source_idx" ON "evidence_signals" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "evidence_sources_talent_idx" ON "evidence_sources" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "matches_need_idx" ON "matches" USING btree ("need_id");--> statement-breakpoint
CREATE INDEX "matches_talent_idx" ON "matches" USING btree ("talent_id");--> statement-breakpoint
CREATE INDEX "needs_org_idx" ON "needs" USING btree ("organization_id");