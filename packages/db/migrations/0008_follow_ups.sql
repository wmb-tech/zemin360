CREATE TYPE "public"."checkin_side" AS ENUM('talent', 'organization');--> statement-breakpoint
CREATE TABLE "collaboration_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"side" "checkin_side" NOT NULL,
	"token_hash" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"status" "collaboration_status",
	"feedback" text,
	"insight" jsonb,
	CONSTRAINT "collaboration_checkins_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "last_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "silent_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collaboration_checkins" ADD CONSTRAINT "collaboration_checkins_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaboration_checkins_collab_idx" ON "collaboration_checkins" USING btree ("collaboration_id");