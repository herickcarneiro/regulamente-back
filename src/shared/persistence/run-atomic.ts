import type { Result } from '../../modules/base/core/result/result';
import type { TransactionContext, UnitOfWork } from './unit-of-work';

class TransactionRollback<E> extends Error {
  readonly result: Result<never, E>;

  constructor(result: Result<never, E>) {
    super('TRANSACTION_ROLLBACK');
    this.name = 'TransactionRollback';
    this.result = result;
  }
}

/**
 * Runs work inside a UnitOfWork transaction.
 * A failed Result aborts the transaction (no silent partial commit).
 */
export async function runAtomic<T, E>(
  uow: UnitOfWork,
  work: (tx: TransactionContext) => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
  try {
    return await uow.runInTransaction(async (tx) => {
      const result = await work(tx);
      if (!result.ok) {
        throw new TransactionRollback(result);
      }
      return result;
    });
  } catch (error) {
    if (error instanceof TransactionRollback) {
      return error.result;
    }
    throw error;
  }
}
