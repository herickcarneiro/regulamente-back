import type { DomainError } from '../../../base/core/errors/domain.error';
import type { Result } from '../../../base/core/result/result';
import {
  AuditEvent,
  type RecordAuditEventInput,
} from '../entities/audit-event.entity';
import type { AuditEventRepository } from '../repositories/audit-event.repository';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';

export type AppendAuditEventInput = Omit<RecordAuditEventInput, 'id' | 'occurredAt' | 'scope'> & {
  scope?: RecordAuditEventInput['scope'];
  occurredAt?: Date;
  id?: string;
};

export type AppendAuditEventDeps = {
  events: AuditEventRepository;
  now: () => Date;
  newId: () => string;
};

export class AppendAuditEventUseCase {
  constructor(private readonly deps: AppendAuditEventDeps) {}

  async execute(
    input: AppendAuditEventInput,
    tx?: TransactionContext,
  ): Promise<Result<AuditEvent, DomainError>> {
    const recorded = AuditEvent.record({
      id: input.id ?? this.deps.newId(),
      occurredAt: input.occurredAt ?? this.deps.now(),
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: input.action,
      scope: input.scope,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
    });
    if (!recorded.ok) {
      return recorded;
    }
    const saved = await this.deps.events.append(recorded.value, tx);
    return { ok: true, value: saved };
  }
}
