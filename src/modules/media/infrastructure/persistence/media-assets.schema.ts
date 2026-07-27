import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    originalFileName: text('original_file_name').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    durationSeconds: integer('duration_seconds'),
    providerRef: text('provider_ref').notNull(),
    /** Internal abandoned-upload TTL; never on the wire. */
    uploadExpiresAt: timestamp('upload_expires_at', {
      withTimezone: true,
    }).notNull(),
    createdByUserId: uuid('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('media_assets_updated_at_id_idx').on(
      table.updatedAt.desc(),
      table.id.asc(),
    ),
    index('media_assets_status_idx').on(table.status),
    index('media_assets_kind_idx').on(table.kind),
    index('media_assets_upload_expires_at_idx').on(table.uploadExpiresAt),
    check('media_assets_kind_check', sql`${table.kind} in ('video')`),
    check(
      'media_assets_status_check',
      sql`${table.status} in ('pending_upload', 'processing', 'ready', 'failed')`,
    ),
    check(
      'media_assets_duration_check',
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
  ],
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
