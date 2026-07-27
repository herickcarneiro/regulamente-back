import { ok, type Result } from '../result/result';
import type { Entity } from '../entities/entity';
import type { Repository } from '../repositories/repository.interface';
import type { DomainError } from '../errors/domain.error';

export class DeleteUseCase<
  TEntity extends Entity,
  TCreate,
  TUpdate,
  TFilters,
> {
  constructor(
    private readonly repository: Repository<
      TEntity,
      TCreate,
      TUpdate,
      TFilters
    >,
  ) {}

  async execute(id: string): Promise<Result<void, DomainError>> {
    await this.repository.delete(id);
    return ok(undefined);
  }
}
