import type { AuditEvent } from '../../core/entities/audit-event.entity';
import { AuditEvent as AuditEventEntity } from '../../core/entities/audit-event.entity';
import type { AuditActorRole } from '../../core/value-objects/audit-actor-role';
import type { AuditAction } from '../../core/value-objects/audit-action';
import type { AuditScope } from '../../core/value-objects/audit-scope';
import type { AuditTargetType } from '../../core/value-objects/audit-target-type';
import type { AuditEventRow } from '../persistence/audit-events.schema';

export const AuditEventMapper = {
  toDomain(row: AuditEventRow): AuditEvent {
    return AuditEventEntity.restore({
      id: row.id,
      occurredAt: row.occurredAt,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      actorRole: row.actorRole as AuditActorRole,
      action: row.action as AuditAction,
      scope: row.scope as AuditScope,
      targetType: row.targetType as AuditTargetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
    });
  },

  toPersistence(event: AuditEvent): AuditEventRow {
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      actorUserId: event.actorUserId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      scope: event.scope,
      targetType: event.targetType,
      targetId: event.targetId,
      targetLabel: event.targetLabel,
    };
  },
};
