ALTER TABLE "contents" ADD COLUMN "media_asset_id" uuid;--> statement-breakpoint
CREATE INDEX "contents_media_asset_id_idx" ON "contents" ("media_asset_id");--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_media_type_check" CHECK ("media_asset_id" is null or "type" in ('video', 'mixed'));