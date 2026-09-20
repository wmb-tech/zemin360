CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'open', 'closed', 'evaluated');--> statement-breakpoint
CREATE TABLE "challenge_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"talent_id" uuid NOT NULL,
	"repo_url" text NOT NULL,
	"note" text,
	"evaluation" jsonb,
	"rank" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid,
	"organization_id" uuid,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"duration_hours" integer NOT NULL,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"evaluated_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_submissions_uq" ON "challenge_submissions" USING btree ("challenge_id","talent_id");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");