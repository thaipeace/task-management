ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sub_order" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_key_tasks_key_fk" FOREIGN KEY ("parent_key") REFERENCES "public"."tasks"("key") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_key");