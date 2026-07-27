import { ok, type Result } from '../result/result';
import type { Entity } from '../entities/entity';
import type { Repository } from '../repositories/repository.interface';
import type { DomainError } from '../errors/domain.error';

export class CreateUseCase<
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

  async execute(input: TCreate): Promise<Result<TEntity, DomainError>> {
    const entity = await this.repository.create(input);
    return ok(entity);
  }
}
