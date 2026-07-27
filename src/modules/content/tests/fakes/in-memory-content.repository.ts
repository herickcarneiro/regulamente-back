import { fail, ok, type Result } from '../../../base/core/result/result';
import type { Content } from '../../core/entities/content.entity';
import {
  ContentNotEditableError,
  ContentNotFoundError,
  VersionConflictError,
} from '../../core/errors/content.errors';
import type {
  AtomicDraftUpdateError,
  ContentListFilters,
  ContentListResult,
  ContentRepository,
} from '../../core/repositories/content.repository';

export class InMemoryContentRepository implements ContentRepository {
  private readonly items = new Map<string, Content>();

  seed(content: Content): void {
    this.items.set(content.id, content);
  }

  async create(content: Content): Promise<Content> {
    this.items.set(content.id, content);
    return content;
  }

  async findById(id: string): Promise<Content | null> {
    return this.items.get(id) ?? null;
  }

  async list(filters: ContentListFilters): Promise<ContentListResult> {
    let rows = [...this.items.values()];

    if (filters.q) {
      const q = filters.q.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.title.toLowerCase().includes(q) ||
          row.authorName.toLowerCase().includes(q),
      );
    }
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters.type) {
      rows = rows.filter((row) => row.type === filters.type);
    }
    if (filters.category !== undefined) {
      rows = rows.filter((row) => row.category === filters.category);
    }

    rows.sort((a, b) => {
      const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (byUpdated !== 0) return byUpdated;
      return a.id.localeCompare(b.id);
    });

    const total = rows.length;
    const start = (filters.page - 1) * filters.pageSize;
    const items = rows.slice(start, start + filters.pageSize);

    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async updateDraftAtomic(
    next: Content,
    expectedVersion: number,
  ): Promise<Result<Content, AtomicDraftUpdateError>> {
    const current = this.items.get(next.id);
    if (!current) {
      return fail(new ContentNotFoundError());
    }
    if (current.status !== 'draft') {
      return fail(new ContentNotEditableError());
    }
    if (current.version !== expectedVersion) {
      return fail(new VersionConflictError());
    }

    this.items.set(next.id, next);
    return ok(next);
  }

  clear(): void {
    this.items.clear();
  }
}
