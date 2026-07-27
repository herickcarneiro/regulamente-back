import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    actorName: text('actor_name').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    scope: text('scope').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    targetLabel: text('target_label').notNull(),
  },
  (table) => [
    index('audit_events_occurred_at_id_idx').on(
      table.occurredAt.desc(),
      table.id.asc(),
    ),
    index('audit_events_scope_idx').on(table.scope),
    index('audit_events_action_idx').on(table.action),
    index('audit_events_actor_user_id_idx').on(table.actorUserId),
    check(
      'audit_events_actor_role_check',
      sql`${table.actorRole} in ('admin', 'editor', 'pesquisador', 'gestor')`,
    ),
    check(
      'audit_events_action_check',
      sql`${table.action} in ('identity.login_succeeded', 'content.draft_created', 'content.draft_updated', 'media.video_upload_requested')`,
    ),
    check(
      'audit_events_scope_check',
      sql`${table.scope} in ('identity', 'content', 'media')`,
    ),
    check(
      'audit_events_target_type_check',
      sql`${table.targetType} in ('admin_user', 'content', 'media_asset')`,
    ),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
