import { describe, expect, it } from 'bun:test';
import { BaseCrudService } from '../application/services/base-crud.service';
import {
  InMemoryPilotItemRepository,
  type CreatePilotItem,
  type UpdatePilotItem,
} from './pilot/in-memory-pilot-item.repository';
import type { PilotItem } from './pilot/pilot-item.entity';

type PilotDto = { id: string; name: string };

const toDto = (entity: PilotItem): PilotDto => ({
  id: entity.id,
  name: entity.name,
});

describe('BaseCrudService', () => {
  it('creates, lists, updates and soft-deletes through use-cases', async () => {
    const service = new BaseCrudService<
      PilotItem,
      PilotDto,
      CreatePilotItem,
      UpdatePilotItem
    >(new InMemoryPilotItemRepository(), toDto);

    const created = await service.create({ name: 'alpha' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const listed = await service.find();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items).toHaveLength(1);

    const updated = await service.update(created.value.id, { name: 'beta' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.name).toBe('beta');

    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);

    const afterDelete = await service.findById(created.value.id);
    expect(afterDelete.ok).toBe(false);
  });
});
