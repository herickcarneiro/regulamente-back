import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Pilot-only table used to validate BaseDrizzleRepository against Postgres. */
export const pilotItems = pgTable('pilot_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type PilotItemRow = typeof pilotItems.$inferSelect;
