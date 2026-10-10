ALTER TABLE "login_tokens" ADD COLUMN "signup_role" text DEFAULT 'organization' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "introduction_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "talent_consent" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "organization_consent" text;--> statement-breakpoint
ALTER TABLE "talents" ADD COLUMN "preferences" jsonb DEFAULT '{"availability":"open","collaborationTypes":[],"workModes":[],"maxDurationWeeks":null,"weeklyHours":null}'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE matches m SET introduction_requested_at = q.requested_at,
  talent_consent = 'pending',
  organization_consent = CASE WHEN q.organization_requested THEN 'accepted' ELSE 'pending' END
FROM (
  SELECT subject_id, min(created_at) AS requested_at,
    bool_or(coalesce(payload->>'requestedBy', '') = 'organization') AS organization_requested
  FROM approval_queue WHERE action = 'introduce' AND status = 'proposed' GROUP BY subject_id
) q WHERE m.id = q.subject_id AND m.introduced_at IS NULL;
