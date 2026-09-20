CREATE TABLE "scout_invites" (
	"login" text PRIMARY KEY NOT NULL,
	"need_id" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scout_invites" ADD CONSTRAINT "scout_invites_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;