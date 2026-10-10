CREATE TABLE "introduction_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"recipients" text[] NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "introduction_deliveries_queue_id_unique" UNIQUE("queue_id")
);
--> statement-breakpoint
CREATE TABLE "shortlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid NOT NULL,
	"talent_id" uuid NOT NULL,
	"match_id" uuid,
	"rank" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "shortlisted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "introduction_deliveries" ADD CONSTRAINT "introduction_deliveries_queue_id_approval_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."approval_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introduction_deliveries" ADD CONSTRAINT "introduction_deliveries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlist_entries" ADD CONSTRAINT "shortlist_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_entries_need_talent_uq" ON "shortlist_entries" USING btree ("need_id","talent_id");
--> statement-breakpoint
UPDATE matches m SET shortlisted_at = n.shortlist_published_at FROM needs n
WHERE m.need_id = n.id AND n.shortlist_published_at IS NOT NULL;
--> statement-breakpoint
INSERT INTO shortlist_entries (need_id, talent_id, match_id, rank, published_at)
SELECT m.need_id, m.talent_id, m.id, m.rank, coalesce(m.shortlisted_at, m.introduced_at)
FROM matches m WHERE m.shortlisted_at IS NOT NULL OR m.introduced_at IS NOT NULL
ON CONFLICT (need_id, talent_id) DO NOTHING;
