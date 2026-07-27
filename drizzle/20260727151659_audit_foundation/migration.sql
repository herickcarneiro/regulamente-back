CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"scope" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_label" text NOT NULL,
	CONSTRAINT "audit_events_actor_role_check" CHECK ("actor_role" in ('admin', 'editor', 'pesquisador', 'gestor')),
	CONSTRAINT "audit_events_action_check" CHECK ("action" in ('identity.login_succeeded', 'content.draft_created', 'content.draft_updated', 'media.video_upload_requested')),
	CONSTRAINT "audit_events_scope_check" CHECK ("scope" in ('identity', 'content', 'media')),
	CONSTRAINT "audit_events_target_type_check" CHECK ("target_type" in ('admin_user', 'content', 'media_asset'))
);
--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_id_idx" ON "audit_events" ("occurred_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "audit_events_scope_idx" ON "audit_events" ("scope");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" ("action");--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events" ("actor_user_id");