CREATE TABLE "release_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" text NOT NULL,
	"kind" text DEFAULT 'binh-luan' NOT NULL,
	"body" text NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_comments_version_idx" ON "release_comments" USING btree ("project_id","version");