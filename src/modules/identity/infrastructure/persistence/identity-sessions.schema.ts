import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { identityUsers } from './identity-users.schema';

export const identitySessions = pgTable('identity_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => identityUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export type IdentitySessionRow = typeof identitySessions.$inferSelect;
