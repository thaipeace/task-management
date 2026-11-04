CREATE TABLE "task_aliases" (
	"old_key" text PRIMARY KEY NOT NULL,
	"new_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_aliases" ADD CONSTRAINT "task_aliases_new_key_tasks_key_fk" FOREIGN KEY ("new_key") REFERENCES "public"."tasks"("key") ON DELETE cascade ON UPDATE cascade;