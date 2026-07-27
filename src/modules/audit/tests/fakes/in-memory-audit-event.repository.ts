import type { AuditEvent } from '../../core/entities/audit-event.entity';
import type {
  AuditEventListFilters,
  AuditEventListResult,
  AuditEventRepository,
} from '../../core/repositories/audit-event.repository';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly items: AuditEvent[] = [];

  /** Exposed for atomicity tests — clear on "rollback" simulation. */
  snapshot(): AuditEvent[] {
    return [...this.items];
  }

  restore(events: AuditEvent[]): void {
    this.items.length = 0;
    this.items.push(...events);
  }

  async append(
    event: AuditEvent,
    _tx?: TransactionContext,
  ): Promise<AuditEvent> {
    this.items.push(event);
    return event;
  }

  async list(
    filters: AuditEventListFilters,
    _tx?: TransactionContext,
  ): Promise<AuditEventListResult> {
    let rows = [...this.items];
    if (filters.scope) {
      rows = rows.filter((row) => row.scope === filters.scope);
    }
    if (filters.action) {
      rows = rows.filter((row) => row.action === filters.action);
    }
    if (filters.actorUserId) {
      rows = rows.filter((row) => row.actorUserId === filters.actorUserId);
    }

    rows.sort((a, b) => {
      const byOccurred = b.occurredAt.getTime() - a.occurredAt.getTime();
      if (byOccurred !== 0) return byOccurred;
      return a.id.localeCompare(b.id);
    });

    const total = rows.length;
    const offset = (filters.page - 1) * filters.pageSize;
    return {
      items: rows.slice(offset, offset + filters.pageSize),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
}
