CREATE TABLE "dev_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"main_version" text NOT NULL,
	"rc" integer NOT NULL,
	"body" text NOT NULL,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dev_releases" ADD CONSTRAINT "dev_releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_releases" ADD CONSTRAINT "dev_releases_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dev_releases_version_idx" ON "dev_releases" USING btree ("project_id","main_version","rc");