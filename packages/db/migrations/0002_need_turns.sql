ALTER TABLE "needs" ADD COLUMN "turns" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "pending_question" jsonb;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "missing_fields" text[] DEFAULT '{}'::text[] NOT NULL;