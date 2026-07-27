CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author_user_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "contents_type_check" CHECK ("type" in ('video', 'text', 'audio', 'mixed')),
	CONSTRAINT "contents_status_check" CHECK ("status" in ('draft', 'review', 'published', 'paused', 'archived')),
	CONSTRAINT "contents_category_check" CHECK ("category" is null or "category" in ('anxiety', 'anger', 'sadness', 'overload')),
	CONSTRAINT "contents_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE INDEX "contents_updated_at_id_idx" ON "contents" ("updated_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "contents_status_idx" ON "contents" ("status");--> statement-breakpoint
CREATE INDEX "contents_type_idx" ON "contents" ("type");--> statement-breakpoint
CREATE INDEX "contents_category_idx" ON "contents" ("category");