import type { DomainError } from '../../../base/core/errors/domain.error';
import { ok, type Result } from '../../../base/core/result/result';
import type { AuditEvent } from '../../core/entities/audit-event.entity';
import type { AuditEventListFilters } from '../../core/repositories/audit-event.repository';
import type { AppendAuditEventUseCase } from '../../core/use-cases/append-audit-event.use-case';
import type { ListAuditEventsUseCase } from '../../core/use-cases/list-audit-events.use-case';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type {
  AppendAuditEventDto,
  AuditEventDto,
  AuditEventListResponseDto,
} from '../dtos/audit.dto';

export type AuditServiceDeps = {
  appendAuditEvent: AppendAuditEventUseCase;
  listAuditEvents: ListAuditEventsUseCase;
};

/** Application façade — append is internal; list is for authenticated reads. */
export class AuditService {
  constructor(private readonly deps: AuditServiceDeps) {}

  async append(
    input: AppendAuditEventDto,
    tx?: TransactionContext,
  ): Promise<Result<AuditEventDto, DomainError>> {
    const result = await this.deps.appendAuditEvent.execute(input, tx);
    if (!result.ok) {
      return result;
    }
    return ok(this.toDto(result.value));
  }

  async list(
    filters: AuditEventListFilters,
  ): Promise<Result<AuditEventListResponseDto, DomainError>> {
    const result = await this.deps.listAuditEvents.execute(filters);
    if (!result.ok) {
      return result;
    }
    return ok({
      items: result.value.items.map((item) => this.toDto(item)),
      total: result.value.total,
      page: result.value.page,
      pageSize: result.value.pageSize,
    });
  }

  private toDto(event: AuditEvent): AuditEventDto {
    return {
      id: event.id,
      occurredAt: event.occurredAt.toISOString(),
      actorUserId: event.actorUserId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      scope: event.scope,
      targetType: event.targetType,
      targetId: event.targetId,
      targetLabel: event.targetLabel,
    };
  }
}
