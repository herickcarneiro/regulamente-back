import { fail, ok, type Result } from '../result/result';
import type { Entity } from '../entities/entity';
import type { Repository } from '../repositories/repository.interface';
import type { DomainError } from '../errors/domain.error';
import { NotFoundError } from '../errors/not-found.error';

export class FindByIdUseCase<
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

  async execute(id: string): Promise<Result<TEntity, DomainError>> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      return fail(new NotFoundError());
    }
    return ok(entity);
  }
}
