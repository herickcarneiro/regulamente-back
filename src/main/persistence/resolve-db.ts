import type { Database } from './database';
import type { TransactionContext } from '../../shared/persistence/unit-of-work';

export function resolveDb(
  db: Database,
  tx?: TransactionContext,
): Database {
  return (tx as unknown as Database | undefined) ?? db;
}
