import { ok, type Result } from '../result/result';
import type { Entity } from '../entities/entity';
import type {
  FindOptions,
  Repository,
} from '../repositories/repository.interface';
import type { PaginatedEntity } from '../value-objects/paginated-entity';
import type { DomainError } from '../errors/domain.error';

export class FindUseCase<TEntity extends Entity, TCreate, TUpdate, TFilters> {
  constructor(
    private readonly repository: Repository<
      TEntity,
      TCreate,
      TUpdate,
      TFilters
    >,
  ) {}

  async execute(
    options?: FindOptions<TFilters>,
  ): Promise<Result<PaginatedEntity<TEntity>, DomainError>> {
    const page = await this.repository.find(options);
    return ok(page);
  }
}
