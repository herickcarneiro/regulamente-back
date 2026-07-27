CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"original_file_name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"duration_seconds" integer,
	"provider_ref" text NOT NULL,
	"upload_expires_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_assets_kind_check" CHECK ("kind" in ('video')),
	CONSTRAINT "media_assets_status_check" CHECK ("status" in ('pending_upload', 'processing', 'ready', 'failed')),
	CONSTRAINT "media_assets_duration_check" CHECK ("duration_seconds" is null or "duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE INDEX "media_assets_updated_at_id_idx" ON "media_assets" ("updated_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" ("status");--> statement-breakpoint
CREATE INDEX "media_assets_kind_idx" ON "media_assets" ("kind");--> statement-breakpoint
CREATE INDEX "media_assets_upload_expires_at_idx" ON "media_assets" ("upload_expires_at");