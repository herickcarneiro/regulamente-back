import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMigrationsFolder } from '../../../main/persistence/migrate';

describe('contents list index (updated_at DESC, id ASC)', () => {
  it('declares composite index with updated_at DESC then id ASC in Content migration', () => {
    const folder = resolveMigrationsFolder();
    const contentMigration = readdirSync(folder).find((name) =>
      name.includes('content_foundation'),
    );
    expect(contentMigration).toBeDefined();

    const sqlPath = join(folder, contentMigration!, 'migration.sql');
    expect(existsSync(sqlPath)).toBe(true);
    const sql = readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(
      /CREATE INDEX "contents_updated_at_id_idx" ON "contents"[^;]*\("updated_at" DESC[^;]*,\s*"id"\s*(ASC)?\s*\)/i,
    );
    expect(sql).not.toMatch(
      /CREATE INDEX "contents_updated_at_id_idx" ON "contents" \("updated_at","id"\)/,
    );
  });

  it('does not alter the Identity foundation migration', () => {
    const folder = resolveMigrationsFolder();
    const identityMigration = readdirSync(folder).find((name) =>
      name.endsWith('_identity_foundation'),
    );
    expect(identityMigration).toBeDefined();
    const sql = readFileSync(
      join(folder, identityMigration!, 'migration.sql'),
      'utf8',
    );
    expect(sql).toContain('identity_users');
    expect(sql).toContain('identity_sessions');
    expect(sql).not.toContain('contents');
  });
});
