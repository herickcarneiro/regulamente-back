import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { BaseCrudService } from '../../application/services/base-crud.service';
import { registerCrudRoutes } from '../../presentation/routes/register-crud-routes';
import {
  InMemoryPilotItemRepository,
  type CreatePilotItem,
  type UpdatePilotItem,
} from './in-memory-pilot-item.repository';
import type { PilotItem } from './pilot-item.entity';

type PilotDto = { id: string; name: string };

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const paginatedSchema = z.object({
  items: z.array(itemSchema),
  page: z.number(),
  limit: z.number(),
  totalItems: z.number(),
  hasNextPage: z.boolean(),
});

function createPilotApp() {
  const service = new BaseCrudService<
    PilotItem,
    PilotDto,
    CreatePilotItem,
    UpdatePilotItem
  >(new InMemoryPilotItemRepository(), (entity) => ({
    id: entity.id,
    name: entity.name,
  }));

  return registerCrudRoutes(new Elysia(), {
    prefix: '/pilot-items',
    service,
    schemas: {
      create: z.object({ name: z.string().min(1) }),
      update: z.object({ name: z.string().min(1) }),
      itemResponse: itemSchema,
      paginatedResponse: paginatedSchema,
    },
  });
}

describe('pilot registerCrudRoutes', () => {
  it('supports the five CRUD verbs end-to-end via app.handle', async () => {
    const app = createPilotApp();

    const created = await app.handle(
      new Request('http://localhost/pilot-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'gamma' }),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as PilotDto;

    const listed = await app.handle(
      new Request('http://localhost/pilot-items'),
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { items: PilotDto[] };
    expect(listBody.items.some((item) => item.id === createdBody.id)).toBe(
      true,
    );

    const fetched = await app.handle(
      new Request(`http://localhost/pilot-items/${createdBody.id}`),
    );
    expect(fetched.status).toBe(200);

    const patched = await app.handle(
      new Request(`http://localhost/pilot-items/${createdBody.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'delta' }),
      }),
    );
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as PilotDto).name).toBe('delta');

    const deleted = await app.handle(
      new Request(`http://localhost/pilot-items/${createdBody.id}`, {
        method: 'DELETE',
      }),
    );
    expect(deleted.status).toBe(204);

    const missing = await app.handle(
      new Request(`http://localhost/pilot-items/${createdBody.id}`),
    );
    expect(missing.status).toBe(404);
  });
});
