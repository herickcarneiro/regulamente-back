import type { Database } from '../../../../main/persistence/database';
import { resolveDb } from '../../../../main/persistence/resolve-db';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import type { AuditEvent } from '../../core/entities/audit-event.entity';
import type {
  AuditEventListFilters,
  AuditEventListResult,
  AuditEventRepository,
} from '../../core/repositories/audit-event.repository';
import { AuditEventMapper } from '../mappers/audit-event.mapper';
import { auditEvents } from '../persistence/audit-events.schema';

export class DrizzleAuditEventRepository implements AuditEventRepository {
  constructor(private readonly db: Database) {}

  async append(
    event: AuditEvent,
    tx?: TransactionContext,
  ): Promise<AuditEvent> {
    const db = resolveDb(this.db, tx);
    const row = AuditEventMapper.toPersistence(event);
    const rows = await db.insert(auditEvents).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Failed to insert audit event');
    }
    return AuditEventMapper.toDomain(created);
  }

  async list(
    filters: AuditEventListFilters,
    tx?: TransactionContext,
  ): Promise<AuditEventListResult> {
    const db = resolveDb(this.db, tx);
    const where = this.buildWhere(filters);

    const totalRows = await db
      .select({ value: count() })
      .from(auditEvents)
      .where(where);
    const total = Number(totalRows[0]?.value ?? 0);

    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.occurredAt), asc(auditEvents.id))
      .limit(filters.pageSize)
      .offset(offset);

    return {
      items: rows.map((row) => AuditEventMapper.toDomain(row)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  private buildWhere(filters: AuditEventListFilters): SQL | undefined {
    const parts: SQL[] = [];
    if (filters.scope) {
      parts.push(eq(auditEvents.scope, filters.scope));
    }
    if (filters.action) {
      parts.push(eq(auditEvents.action, filters.action));
    }
    if (filters.actorUserId) {
      parts.push(eq(auditEvents.actorUserId, filters.actorUserId));
    }
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return and(...parts);
  }
}
