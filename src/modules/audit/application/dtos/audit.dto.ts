import type { AuditActorRole } from '../../core/value-objects/audit-actor-role';
import type { AuditAction } from '../../core/value-objects/audit-action';
import type { AuditScope } from '../../core/value-objects/audit-scope';
import type { AuditTargetType } from '../../core/value-objects/audit-target-type';

export type AuditEventDto = {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  scope: AuditScope;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
};

export type AuditEventListResponseDto = {
  items: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppendAuditEventDto = {
  actorUserId: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
};
