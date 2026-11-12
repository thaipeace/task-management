ALTER TABLE "dev_releases" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dev_releases" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "dev_releases" ADD CONSTRAINT "dev_releases_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;