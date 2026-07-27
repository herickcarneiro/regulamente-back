import { InvalidInputError } from '../../../base/core/errors/invalid-input.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import { isAuditAction, type AuditAction } from '../value-objects/audit-action';
import {
  isAuditActorRole,
  type AuditActorRole,
} from '../value-objects/audit-actor-role';
import {
  isAuditScope,
  scopeForAction,
  targetTypeForAction,
  type AuditScope,
} from '../value-objects/audit-scope';
import {
  isAuditTargetType,
  type AuditTargetType,
} from '../value-objects/audit-target-type';

export type AuditEventProps = {
  id: string;
  occurredAt: Date;
  actorUserId: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  scope: AuditScope;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
};

export type RecordAuditEventInput = {
  id: string;
  occurredAt: Date;
  actorUserId: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  scope?: AuditScope;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
};

export class AuditEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly actorRole: AuditActorRole;
  readonly action: AuditAction;
  readonly scope: AuditScope;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly targetLabel: string;

  private constructor(props: AuditEventProps) {
    this.id = props.id;
    this.occurredAt = props.occurredAt;
    this.actorUserId = props.actorUserId;
    this.actorName = props.actorName;
    this.actorRole = props.actorRole;
    this.action = props.action;
    this.scope = props.scope;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.targetLabel = props.targetLabel;
    Object.freeze(this);
  }

  static record(
    input: RecordAuditEventInput,
  ): Result<AuditEvent, InvalidInputError> {
    if (!isAuditAction(input.action)) {
      return fail(new InvalidInputError('Invalid audit action'));
    }
    if (!isAuditActorRole(input.actorRole)) {
      return fail(new InvalidInputError('Invalid audit actor role'));
    }
    if (!isAuditTargetType(input.targetType)) {
      return fail(new InvalidInputError('Invalid audit target type'));
    }

    const scope = input.scope ?? scopeForAction(input.action);
    if (!isAuditScope(scope)) {
      return fail(new InvalidInputError('Invalid audit scope'));
    }
    if (scope !== scopeForAction(input.action)) {
      return fail(new InvalidInputError('Audit scope does not match action'));
    }
    if (input.targetType !== targetTypeForAction(input.action)) {
      return fail(
        new InvalidInputError('Audit targetType does not match action'),
      );
    }

    const targetLabel = input.targetLabel.trim();
    if (!targetLabel) {
      return fail(new InvalidInputError('targetLabel is required'));
    }
    if (!input.actorName.trim()) {
      return fail(new InvalidInputError('actorName is required'));
    }
    if (!input.actorUserId.trim() || !input.targetId.trim() || !input.id.trim()) {
      return fail(new InvalidInputError('ids are required'));
    }

    return ok(
      new AuditEvent({
        id: input.id,
        occurredAt: input.occurredAt,
        actorUserId: input.actorUserId,
        actorName: input.actorName.trim(),
        actorRole: input.actorRole,
        action: input.action,
        scope,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel,
      }),
    );
  }

  static restore(props: AuditEventProps): AuditEvent {
    return new AuditEvent(props);
  }
}
