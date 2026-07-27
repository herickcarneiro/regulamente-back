import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type { AuditEvent } from '../entities/audit-event.entity';
import type { AuditAction } from '../value-objects/audit-action';
import type { AuditScope } from '../value-objects/audit-scope';

export type AuditEventListFilters = {
  page: number;
  pageSize: number;
  scope?: AuditScope;
  action?: AuditAction;
  actorUserId?: string;
};

export type AuditEventListResult = {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
};

/** Append-only port — no update/delete at runtime. */
export interface AuditEventRepository {
  append(
    event: AuditEvent,
    tx?: TransactionContext,
  ): Promise<AuditEvent>;
  list(
    filters: AuditEventListFilters,
    tx?: TransactionContext,
  ): Promise<AuditEventListResult>;
}
