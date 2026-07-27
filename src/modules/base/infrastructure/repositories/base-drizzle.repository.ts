import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { Entity } from '../../core/entities/entity';
import type {
  FindOptions,
  Repository,
} from '../../core/repositories/repository.interface';
import {
  paginate,
  type PaginatedEntity,
} from '../../core/value-objects/paginated-entity';
import type { BaseMapper } from '../mappers/base.mapper';

/**
 * Soft-delete Drizzle repository.
 * Table typing is intentionally loose so module tables can extend the base
 * without fighting PgColumn generics across Drizzle RC versions.
 */
export abstract class BaseDrizzleRepository<
  TEntity extends Entity,
  TCreate,
  TUpdate,
  TFilters,
  TRow extends { id: string },
> implements Repository<TEntity, TCreate, TUpdate, TFilters>
{
  protected constructor(
    protected readonly db: any,
    protected readonly mapper: BaseMapper<TRow, TEntity>,
  ) {}

  protected abstract get table(): any;
  protected abstract buildWhere(filters?: TFilters): SQL | undefined;
  protected abstract mapCreateValues(
    dto: TCreate,
  ): Record<string, unknown>;
  protected abstract mapUpdateValues(
    dto: TUpdate,
  ): Record<string, unknown>;

  async find(
    options: FindOptions<TFilters> = {},
  ): Promise<PaginatedEntity<TEntity>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const offset = (page - 1) * limit;
    const filterWhere = this.buildWhere(options.filters);
    const where = and(isNull(this.table.deletedAt), filterWhere);

    const rows = (await this.db
      .select()
      .from(this.table)
      .where(where)
      .limit(limit)
      .offset(offset)) as TRow[];

    const [{ count }] = (await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(this.table)
      .where(where)) as [{ count: number }];

    return paginate(
      rows.map((row) => this.mapper.toDomain(row)),
      Number(count),
      page,
      limit,
    );
  }

  async findById(id: string): Promise<TEntity | null> {
    const rows = (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), isNull(this.table.deletedAt)))
      .limit(1)) as TRow[];

    const row = rows[0];
    return row ? this.mapper.toDomain(row) : null;
  }

  async create(dto: TCreate): Promise<TEntity> {
    const now = new Date();
    const values = {
      ...this.mapCreateValues(dto),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const rows = (await this.db
      .insert(this.table)
      .values(values)
      .returning()) as TRow[];

    const row = rows[0];
    if (!row) {
      throw new Error('Insert returned no rows');
    }
    return this.mapper.toDomain(row);
  }

  async update(id: string, dto: TUpdate): Promise<TEntity | null> {
    const rows = (await this.db
      .update(this.table)
      .set({
        ...this.mapUpdateValues(dto),
        updatedAt: new Date(),
      })
      .where(and(eq(this.table.id, id), isNull(this.table.deletedAt)))
      .returning()) as TRow[];

    const row = rows[0];
    return row ? this.mapper.toDomain(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(this.table.id, id), isNull(this.table.deletedAt)));
  }
}
