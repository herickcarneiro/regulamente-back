import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../../main/persistence/database';
import { resolveDb } from '../../../../main/persistence/resolve-db';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
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
import { ContentMapper } from '../mappers/content.mapper';
import { contents } from '../persistence/contents.schema';

export class DrizzleContentRepository implements ContentRepository {
  constructor(private readonly db: Database) {}

  async create(
    content: Content,
    tx?: TransactionContext,
  ): Promise<Content> {
    const db = resolveDb(this.db, tx);
    const row = ContentMapper.toPersistence(content);
    const rows = await db.insert(contents).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Failed to insert content');
    }
    return ContentMapper.toDomain(created);
  }

  async findById(
    id: string,
    tx?: TransactionContext,
  ): Promise<Content | null> {
    const db = resolveDb(this.db, tx);
    const rows = await db
      .select()
      .from(contents)
      .where(eq(contents.id, id))
      .limit(1);
    const row = rows[0];
    return row ? ContentMapper.toDomain(row) : null;
  }

  async list(filters: ContentListFilters): Promise<ContentListResult> {
    const where = this.buildWhere(filters);

    const totalRows = await this.db
      .select({ value: count() })
      .from(contents)
      .where(where);
    const total = Number(totalRows[0]?.value ?? 0);

    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.db
      .select()
      .from(contents)
      .where(where)
      .orderBy(desc(contents.updatedAt), asc(contents.id))
      .limit(filters.pageSize)
      .offset(offset);

    return {
      items: rows.map((row) => ContentMapper.toDomain(row)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async updateDraftAtomic(
    next: Content,
    expectedVersion: number,
    tx?: TransactionContext,
  ): Promise<Result<Content, AtomicDraftUpdateError>> {
    const db = resolveDb(this.db, tx);
    // Atomic mutation: only a matching draft+version row is updated.
    const rows = await db
      .update(contents)
      .set({
        title: next.title,
        type: next.type,
        category: next.category,
        description: next.description,
        body: next.body,
        mediaAssetId: next.mediaAssetId,
        version: next.version,
        updatedAt: next.updatedAt,
      })
      .where(
        and(
          eq(contents.id, next.id),
          eq(contents.version, expectedVersion),
          eq(contents.status, 'draft'),
        ),
      )
      .returning();

    const updated = rows[0];
    if (updated) {
      return ok(ContentMapper.toDomain(updated));
    }

    // Error classification from a later read — may see a newer state.
    const existing = await this.findById(next.id, tx);
    if (!existing) {
      return fail(new ContentNotFoundError());
    }
    if (existing.status !== 'draft') {
      return fail(new ContentNotEditableError());
    }
    return fail(new VersionConflictError());
  }

  private buildWhere(filters: ContentListFilters): SQL | undefined {
    const parts: SQL[] = [];

    if (filters.q?.trim()) {
      const pattern = `%${filters.q.trim()}%`;
      parts.push(
        or(
          ilike(contents.title, pattern),
          ilike(contents.authorName, pattern),
        )!,
      );
    }
    if (filters.status) {
      parts.push(eq(contents.status, filters.status));
    }
    if (filters.type) {
      parts.push(eq(contents.type, filters.type));
    }
    if (filters.category !== undefined) {
      if (filters.category === null) {
        parts.push(sql`${contents.category} is null`);
      } else {
        parts.push(eq(contents.category, filters.category));
      }
    }

    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return and(...parts);
  }
}
