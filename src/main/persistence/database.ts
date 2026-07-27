import { drizzle } from 'drizzle-orm/bun-sql';
import type { SQL } from 'bun';

function openDatabase(connectionString: string) {
  return drizzle(connectionString);
}

export type Database = ReturnType<typeof openDatabase>;

export type DatabaseHandle = {
  db: Database;
  close: () => Promise<void>;
};

export function createDatabase(connectionString: string): DatabaseHandle {
  const db = openDatabase(connectionString);
  const client = db.$client as SQL;

  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}
