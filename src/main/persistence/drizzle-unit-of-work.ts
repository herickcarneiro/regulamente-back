import type { Database } from './database';
import type {
  TransactionContext,
  UnitOfWork,
} from '../../shared/persistence/unit-of-work';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  async runInTransaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) =>
      work(tx as unknown as TransactionContext),
    );
  }
}
