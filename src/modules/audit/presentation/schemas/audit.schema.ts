import { z } from 'zod';
import type { AssertTrue, Exact } from '../../../../shared/openapi/openapi';
import type {
  AuditEventDto,
  AuditEventListResponseDto,
} from '../../application/dtos/audit.dto';
import { AUDIT_ACTOR_ROLES } from '../../core/value-objects/audit-actor-role';
import { AUDIT_TARGET_TYPES } from '../../core/value-objects/audit-target-type';
import { AUDIT_ACTIONS } from '../../core/value-objects/audit-action';
import { AUDIT_SCOPES } from '../../core/value-objects/audit-scope';

export const auditEventListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(AUDIT_SCOPES).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorUserId: z.uuid().optional(),
});

export type AuditEventListQuery = z.infer<typeof auditEventListQuerySchema>;

// --- Respostas (documentação OpenAPI; espelham os DTOs da application) ---

export const auditEventSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  actorUserId: z.uuid(),
  actorName: z.string(),
  actorRole: z.enum(AUDIT_ACTOR_ROLES),
  action: z.enum(AUDIT_ACTIONS),
  scope: z.enum(AUDIT_SCOPES),
  targetType: z.enum(AUDIT_TARGET_TYPES),
  targetId: z.string(),
  targetLabel: z.string(),
});

export const auditEventListResponseSchema = z.object({
  items: z.array(auditEventSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export type _AuditEventCheck = AssertTrue<
  Exact<z.infer<typeof auditEventSchema>, AuditEventDto>
>;
export type _AuditEventListResponseCheck = AssertTrue<
  Exact<z.infer<typeof auditEventListResponseSchema>, AuditEventListResponseDto>
>;
