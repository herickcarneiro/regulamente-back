import { describe, expect, it } from 'bun:test';
import type { Result } from '../../modules/base/core/result/result';
import { fail, ok } from '../../modules/base/core/result/result';
import { runAtomic } from './run-atomic';
import type { TransactionContext, UnitOfWork } from './unit-of-work';

class RecordingUnitOfWork implements UnitOfWork {
  started = 0;
  committed = 0;
  rolledBack = 0;

  async runInTransaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    this.started += 1;
    const tx = { id: this.started } as unknown as TransactionContext;
    try {
      const value = await work(tx);
      this.committed += 1;
      return value;
    } catch (error) {
      this.rolledBack += 1;
      throw error;
    }
  }
}

describe('runAtomic', () => {
  it('commits when work returns ok', async () => {
    const uow = new RecordingUnitOfWork();
    const result = await runAtomic(uow, async () => ok('done'));
    expect(result).toEqual(ok('done'));
    expect(uow.committed).toBe(1);
    expect(uow.rolledBack).toBe(0);
  });

  it('rolls back when work returns fail without committing', async () => {
    const uow = new RecordingUnitOfWork();
    const result = await runAtomic(uow, async () =>
      fail({ code: 'NOT_FOUND' }),
    );
    expect(result.ok).toBe(false);
    expect(uow.committed).toBe(0);
    expect(uow.rolledBack).toBe(1);
  });

  it('propagates unexpected throws after rollback', async () => {
    const uow = new RecordingUnitOfWork();
    await expect(
      runAtomic(uow, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(uow.rolledBack).toBe(1);
  });
});

describe('InMemoryUnitOfWork', () => {
  it('passes a shared transaction context to nested work', async () => {
    const { InMemoryUnitOfWork } = await import(
      '../testing/fakes/in-memory-unit-of-work'
    );
    const uow = new InMemoryUnitOfWork();
    let seen: TransactionContext | undefined;
    const result: Result<string, never> = await runAtomic(uow, async (tx) => {
      seen = tx;
      return ok('ok');
    });
    expect(result.ok).toBe(true);
    expect(seen).toBeDefined();
  });
});
