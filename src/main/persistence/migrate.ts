import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { loadEnv } from '../config/env';
import { createDatabase } from './database';

export function resolveMigrationsFolder(
  fromDir: string = import.meta.dir,
): string {
  return resolve(fromDir, '../../../drizzle');
}

export async function runMigrations(
  connectionString: string,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<{ migrationsFolder: string }> {
  const database = createDatabase(connectionString);

  try {
    await migrate(database.db, { migrationsFolder });
    return { migrationsFolder };
  } finally {
    await database.close();
  }
}

if (import.meta.main) {
  const env = loadEnv();
  const { migrationsFolder } = await runMigrations(env.DATABASE_URL);
  console.log(
    JSON.stringify({
      migrated: true,
      migrationsFolder,
    }),
  );
}
