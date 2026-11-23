import type { OpenApiModule } from '../../../shared/openapi/openapi';
import { jsonResponse } from '../../../shared/openapi/openapi';
import { healthResponseSchema } from './health.schema';

export const healthOpenApi: OpenApiModule = {
  tag: { name: 'Health', description: 'Verificação de disponibilidade.' },
  schemas: { HealthResponse: healthResponseSchema },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        operationId: 'getHealth',
        summary: 'Health check',
        description: 'Rota pública e silenciosa no log HTTP.',
        security: [],
        responses: {
          '200': jsonResponse('Serviço disponível.', 'HealthResponse'),
        },
      },
    },
  },
};
