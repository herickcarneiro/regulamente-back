import { z } from 'zod';
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
