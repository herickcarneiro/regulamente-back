import type {
  FindOptions,
  Repository,
} from '../../core/repositories/repository.interface';
import {
  paginate,
  type PaginatedEntity,
} from '../../core/value-objects/paginated-entity';
import { PilotItem } from './pilot-item.entity';

export type CreatePilotItem = { name: string };
export type UpdatePilotItem = { name: string };

export class InMemoryPilotItemRepository
  implements Repository<PilotItem, CreatePilotItem, UpdatePilotItem>
{
  private readonly items = new Map<string, PilotItem>();

  async find(
    options: FindOptions = {},
  ): Promise<PaginatedEntity<PilotItem>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const all = [...this.items.values()].filter((item) => !item.deletedAt);
    const offset = (page - 1) * limit;
    return paginate(all.slice(offset, offset + limit), all.length, page, limit);
  }

  async findById(id: string): Promise<PilotItem | null> {
    const item = this.items.get(id);
    if (!item || item.deletedAt) return null;
    return item;
  }

  async create(dto: CreatePilotItem): Promise<PilotItem> {
    const item = PilotItem.create(dto.name);
    this.items.set(item.id, item);
    return item;
  }

  async update(id: string, dto: UpdatePilotItem): Promise<PilotItem | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const updated = current.rename(dto.name);
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const current = await this.findById(id);
    if (!current) return;
    this.items.set(
      id,
      PilotItem.restore({
        id: current.id,
        name: current.name,
        createdAt: current.createdAt,
        updatedAt: new Date(),
        deletedAt: new Date(),
      }),
    );
  }
}
