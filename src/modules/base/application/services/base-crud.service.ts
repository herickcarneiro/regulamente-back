import type { DomainError } from '../../core/errors/domain.error';
import type { Entity } from '../../core/entities/entity';
import type {
  FindOptions,
  Repository,
} from '../../core/repositories/repository.interface';
import type { Result } from '../../core/result/result';
import { CreateUseCase } from '../../core/use-cases/create.use-case';
import { DeleteUseCase } from '../../core/use-cases/delete.use-case';
import { FindByIdUseCase } from '../../core/use-cases/find-by-id.use-case';
import { FindUseCase } from '../../core/use-cases/find.use-case';
import { UpdateUseCase } from '../../core/use-cases/update.use-case';
import type { PaginatedResponseDTO } from '../dtos/pagination.dto';

export class BaseCrudService<
  TEntity extends Entity,
  TDto,
  TCreate,
  TUpdate,
  TFilters = Record<string, unknown>,
> {
  private readonly createUseCase: CreateUseCase<
    TEntity,
    TCreate,
    TUpdate,
    TFilters
  >;
  private readonly findUseCase: FindUseCase<TEntity, TCreate, TUpdate, TFilters>;
  private readonly findByIdUseCase: FindByIdUseCase<
    TEntity,
    TCreate,
    TUpdate,
    TFilters
  >;
  private readonly updateUseCase: UpdateUseCase<
    TEntity,
    TCreate,
    TUpdate,
    TFilters
  >;
  private readonly deleteUseCase: DeleteUseCase<
    TEntity,
    TCreate,
    TUpdate,
    TFilters
  >;

  constructor(
    repository: Repository<TEntity, TCreate, TUpdate, TFilters>,
    private readonly toDto: (entity: TEntity) => TDto,
  ) {
    this.createUseCase = new CreateUseCase(repository);
    this.findUseCase = new FindUseCase(repository);
    this.findByIdUseCase = new FindByIdUseCase(repository);
    this.updateUseCase = new UpdateUseCase(repository);
    this.deleteUseCase = new DeleteUseCase(repository);
  }

  async create(input: TCreate): Promise<Result<TDto, DomainError>> {
    const result = await this.createUseCase.execute(input);
    if (!result.ok) return result;
    return { ok: true, value: this.toDto(result.value) };
  }

  async find(
    options?: FindOptions<TFilters>,
  ): Promise<Result<PaginatedResponseDTO<TDto>, DomainError>> {
    const result = await this.findUseCase.execute(options);
    if (!result.ok) return result;
    return {
      ok: true,
      value: {
        items: result.value.items.map(this.toDto),
        page: result.value.page,
        limit: result.value.limit,
        totalItems: result.value.totalItems,
        hasNextPage: result.value.hasNextPage,
      },
    };
  }

  async findById(id: string): Promise<Result<TDto, DomainError>> {
    const result = await this.findByIdUseCase.execute(id);
    if (!result.ok) return result;
    return { ok: true, value: this.toDto(result.value) };
  }

  async update(
    id: string,
    input: TUpdate,
  ): Promise<Result<TDto, DomainError>> {
    const result = await this.updateUseCase.execute(id, input);
    if (!result.ok) return result;
    return { ok: true, value: this.toDto(result.value) };
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    return this.deleteUseCase.execute(id);
  }
}
