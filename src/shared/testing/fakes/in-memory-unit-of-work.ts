import type { TransactionContext, UnitOfWork } from '../../persistence/unit-of-work';

const brand = Symbol('InMemoryTransaction');

export class InMemoryUnitOfWork implements UnitOfWork {
  async runInTransaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const tx = { [brand]: true } as unknown as TransactionContext;
    return work(tx);
  }
}
