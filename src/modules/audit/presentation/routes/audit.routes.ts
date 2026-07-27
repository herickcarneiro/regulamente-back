import { Elysia } from 'elysia';
import type { IdentityService } from '../../../identity/application/services/identity.service';
import { readSessionCookie } from '../../../identity/presentation/plugins/session-cookie';
import type { AuditService } from '../../application/services/audit.service';
import { respondAuditError } from '../errors/map-audit-error';
import { auditEventListQuerySchema } from '../schemas/audit.schema';

export type AuditRoutesDeps = {
  auditService: AuditService;
  identityService: IdentityService;
};

function validationError(
  set: { status?: number | string },
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  set.status = 400;
  return {
    error: 'validation' as const,
    message: 'Invalid request',
    details: issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  };
}

export function createAuditRoutes(deps: AuditRoutesDeps) {
  return new Elysia({ name: 'audit' }).group('/api/v1/audit-events', (app) =>
    app.get('/', async ({ request, query, set }) => {
      const token = readSessionCookie(request.headers.get('cookie'));
      const session = await deps.identityService.getSession(token);
      if (!session.ok) {
        return respondAuditError(set, session.error);
      }

      const parsed = auditEventListQuerySchema.safeParse(query);
      if (!parsed.success) {
        return validationError(set, parsed.error.issues);
      }

      const result = await deps.auditService.list({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        scope: parsed.data.scope,
        action: parsed.data.action,
        actorUserId: parsed.data.actorUserId,
      });
      if (!result.ok) {
        return respondAuditError(set, result.error);
      }
      return result.value;
    }),
  );
}
