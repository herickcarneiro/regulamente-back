import type { DomainError } from '../../../base/core/errors/domain.error';
import { ok, type Result } from '../../../base/core/result/result';
import type {
  AuditEventListFilters,
  AuditEventListResult,
  AuditEventRepository,
} from '../repositories/audit-event.repository';

export type ListAuditEventsDeps = {
  events: AuditEventRepository;
};

export class ListAuditEventsUseCase {
  constructor(private readonly deps: ListAuditEventsDeps) {}

  async execute(
    filters: AuditEventListFilters,
  ): Promise<Result<AuditEventListResult, DomainError>> {
    const result = await this.deps.events.list(filters);
    return ok(result);
  }
}
