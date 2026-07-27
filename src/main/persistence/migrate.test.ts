import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDatabase } from './database';
import { resolveMigrationsFolder, runMigrations } from './migrate';

describe('Bun SQL migrator runner', () => {
  it('resolves identity_foundation without pilot harness tables', () => {
    const folder = resolveMigrationsFolder();
    const foundation = readdirSync(folder).find((name) =>
      name.endsWith('_identity_foundation'),
    );
    expect(foundation).toBeDefined();
    const sqlPath = join(folder, foundation!, 'migration.sql');
    expect(existsSync(sqlPath)).toBe(true);
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('identity_users');
    expect(sql).toContain('identity_sessions');
    expect(sql).not.toContain('pilot_items');
  });

  describe.skipIf(!process.env.DATABASE_URL)('against Postgres', () => {
    const databaseUrl = process.env.DATABASE_URL!;

    beforeAll(async () => {
      await runMigrations(databaseUrl);
    });

    afterAll(async () => {
      // ensure runner close path already executed; open/close once more for sanity
      const database = createDatabase(databaseUrl);
      await database.close();
    });

    it('applies migrations idempotently and closes the connection', async () => {
      await expect(runMigrations(databaseUrl)).resolves.toMatchObject({
        migrationsFolder: resolveMigrationsFolder(),
      });
      await expect(runMigrations(databaseUrl)).resolves.toMatchObject({
        migrationsFolder: resolveMigrationsFolder(),
      });
    });
  });
});
