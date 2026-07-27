import type { Entity } from '../entities/entity';
import type { PaginatedEntity } from '../value-objects/paginated-entity';

export type FindOptions<TFilters = Record<string, unknown>> = {
  page?: number;
  limit?: number;
  filters?: TFilters;
};

export interface Repository<
  TEntity extends Entity,
  TCreate = unknown,
  TUpdate = unknown,
  TFilters = Record<string, unknown>,
> {
  find(options?: FindOptions<TFilters>): Promise<PaginatedEntity<TEntity>>;
  findById(id: string): Promise<TEntity | null>;
  create(dto: TCreate): Promise<TEntity>;
  update(id: string, dto: TUpdate): Promise<TEntity | null>;
  delete(id: string): Promise<void>;
}
