-- Tầng dự án. Dữ liệu đang có thuộc dự án SIA (SirobyApp), id việc giữ nguyên (key_prefix rỗng).
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"key_prefix" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
INSERT INTO "projects" ("code", "name", "key_prefix") VALUES ('SIA', 'SirobyApp', '');
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_sprint_sprints_code_fk";--> statement-breakpoint
ALTER TABLE "meta" DROP CONSTRAINT "meta_pkey";--> statement-breakpoint
ALTER TABLE "sprints" DROP CONSTRAINT "sprints_pkey";--> statement-breakpoint
ALTER TABLE "counters" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "meta" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" integer;--> statement-breakpoint
UPDATE "counters" SET "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'SIA');--> statement-breakpoint
UPDATE "meta" SET "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'SIA');--> statement-breakpoint
UPDATE "records" SET "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'SIA');--> statement-breakpoint
UPDATE "sprints" SET "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'SIA');--> statement-breakpoint
UPDATE "tasks" SET "project_id" = (SELECT "id" FROM "projects" WHERE "code" = 'SIA');--> statement-breakpoint
ALTER TABLE "counters" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meta" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sprints" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meta" ADD CONSTRAINT "meta_project_id_key_pk" PRIMARY KEY("project_id","key");--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_code_pk" PRIMARY KEY("project_id","code");--> statement-breakpoint
ALTER TABLE "counters" ADD CONSTRAINT "counters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta" ADD CONSTRAINT "meta_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_fk" FOREIGN KEY ("project_id","sprint") REFERENCES "public"."sprints"("project_id","code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");
