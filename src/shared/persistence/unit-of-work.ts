/** Opaque transaction handle — infrastructure brands the concrete client. */
export type TransactionContext = {
  readonly __brand: 'TransactionContext';
};

export interface UnitOfWork {
  runInTransaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
}
