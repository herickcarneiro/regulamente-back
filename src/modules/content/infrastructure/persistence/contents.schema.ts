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

export const contents = pgTable(
  'contents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    category: text('category'),
    status: text('status').notNull().default('draft'),
    description: text('description').notNull().default(''),
    body: text('body').notNull().default(''),
    authorUserId: uuid('author_user_id').notNull(),
    authorName: text('author_name').notNull(),
    version: integer('version').notNull().default(1),
    mediaAssetId: uuid('media_asset_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('contents_updated_at_id_idx').on(
      table.updatedAt.desc(),
      table.id.asc(),
    ),
    index('contents_status_idx').on(table.status),
    index('contents_type_idx').on(table.type),
    index('contents_category_idx').on(table.category),
    index('contents_media_asset_id_idx').on(table.mediaAssetId),
    check(
      'contents_type_check',
      sql`${table.type} in ('video', 'text', 'audio', 'mixed')`,
    ),
    check(
      'contents_status_check',
      sql`${table.status} in ('draft', 'review', 'published', 'paused', 'archived')`,
    ),
    check(
      'contents_category_check',
      sql`${table.category} is null or ${table.category} in ('anxiety', 'anger', 'sadness', 'overload')`,
    ),
    check('contents_version_check', sql`${table.version} >= 1`),
    check(
      'contents_media_type_check',
      sql`${table.mediaAssetId} is null or ${table.type} in ('video', 'mixed')`,
    ),
  ],
);

export type ContentRow = typeof contents.$inferSelect;
