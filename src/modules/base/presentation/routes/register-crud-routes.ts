import { Elysia } from 'elysia';
import type { z } from 'zod';
import type { BaseCrudService } from '../../application/services/base-crud.service';
import type { DomainError } from '../../core/errors/domain.error';
import type { Entity } from '../../core/entities/entity';
import {
  domainErrorBody,
  mapDomainErrorToStatus,
} from '../errors/map-domain-error';

type CrudSchemas = {
  create: z.ZodType;
  update: z.ZodType;
  listQuery?: z.ZodType;
  itemResponse: z.ZodType;
  paginatedResponse: z.ZodType;
};

type RegisterCrudRoutesOptions<
  TEntity extends Entity,
  TDto,
  TCreate,
  TUpdate,
  TFilters,
> = {
  prefix: string;
  service: BaseCrudService<TEntity, TDto, TCreate, TUpdate, TFilters>;
  schemas: CrudSchemas;
};

function respondError(set: { status?: number | string }, error: DomainError) {
  set.status = mapDomainErrorToStatus(error);
  return domainErrorBody(error);
}

export function registerCrudRoutes<
  TEntity extends Entity,
  TDto,
  TCreate,
  TUpdate,
  TFilters,
>(
  app: Elysia,
  options: RegisterCrudRoutesOptions<
    TEntity,
    TDto,
    TCreate,
    TUpdate,
    TFilters
  >,
) {
  const { prefix, service, schemas } = options;

  return app.group(prefix, (group) =>
    group
      .get(
        '/',
        async ({ query, set }) => {
          const page = Number((query as { page?: string }).page ?? 1);
          const limit = Number((query as { limit?: string }).limit ?? 20);
          const result = await service.find({ page, limit });
          if (!result.ok) return respondError(set, result.error);
          return result.value;
        },
        {
          response: schemas.paginatedResponse,
        },
      )
      .get(
        '/:id',
        async ({ params, set }) => {
          const result = await service.findById(params.id);
          if (!result.ok) return respondError(set, result.error);
          return result.value;
        },
        {
          response: schemas.itemResponse,
        },
      )
      .post(
        '/',
        async ({ body, set }) => {
          const result = await service.create(body as TCreate);
          if (!result.ok) return respondError(set, result.error);
          set.status = 201;
          return result.value;
        },
        {
          body: schemas.create,
          response: schemas.itemResponse,
        },
      )
      .patch(
        '/:id',
        async ({ params, body, set }) => {
          const result = await service.update(params.id, body as TUpdate);
          if (!result.ok) return respondError(set, result.error);
          return result.value;
        },
        {
          body: schemas.update,
          response: schemas.itemResponse,
        },
      )
      .delete('/:id', async ({ params, set }) => {
        const result = await service.delete(params.id);
        if (!result.ok) return respondError(set, result.error);
        set.status = 204;
        return;
      }),
  );
}
