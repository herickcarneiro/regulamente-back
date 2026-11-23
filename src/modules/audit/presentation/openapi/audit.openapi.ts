import type { OpenApiModule } from '../../../../shared/openapi/openapi';
import {
  authErrors,
  errorResponses,
  jsonResponse,
  queryParameters,
  requiresSession,
} from '../../../../shared/openapi/openapi';
import {
  auditEventListQuerySchema,
  auditEventListResponseSchema,
  auditEventSchema,
} from '../schemas/audit.schema';

const TAG = 'Audit';

export const auditOpenApi: OpenApiModule = {
  tag: {
    name: TAG,
    description:
      'Eventos de auditoria append-only. Qualquer usuário autenticado pode consultar (sem PermissionKey).',
  },
  schemas: {
    AuditEvent: auditEventSchema,
    AuditEventList: auditEventListResponseSchema,
  },
  paths: {
    '/api/v1/audit-events': {
      get: {
        tags: [TAG],
        operationId: 'listAuditEvents',
        summary: 'Listar eventos de auditoria',
        description: 'Paginado, mais recentes primeiro.',
        security: requiresSession,
        parameters: queryParameters(auditEventListQuerySchema),
        responses: {
          '200': jsonResponse('Página de eventos.', 'AuditEventList'),
          ...errorResponses({
            ...authErrors(),
            validation: 'Parâmetros inválidos (campos desconhecidos são rejeitados).',
          }),
        },
      },
    },
  },
};
