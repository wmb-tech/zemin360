CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"talent_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_talent_id_talents_id_fk" FOREIGN KEY ("talent_id") REFERENCES "public"."talents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_installations_talent_idx" ON "github_installations" USING btree ("talent_id");--> statement-breakpoint
-- Geri doldurma: eski tek-kurulum alanı kişisel kurulum olarak taşınır (canlıdaki ilk gerçek kullanıcı).
INSERT INTO "github_installations" ("talent_id", "installation_id", "account_login", "account_type")
SELECT t."id", t."github_installation_id", COALESCE(u."github_login", ''), 'user'
FROM "talents" t JOIN "users" u ON u."id" = t."user_id"
WHERE t."github_installation_id" IS NOT NULL
ON CONFLICT ("installation_id") DO NOTHING;
