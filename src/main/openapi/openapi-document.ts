import { auditOpenApi } from '../../modules/audit/presentation/openapi/audit.openapi';
import { contentOpenApi } from '../../modules/content/presentation/openapi/content.openapi';
import { healthOpenApi } from '../../modules/health/presentation/health.openapi';
import { identityOpenApi } from '../../modules/identity/presentation/openapi/identity.openapi';
import { SESSION_COOKIE_NAME } from '../../modules/identity/presentation/plugins/session-cookie';
import { mediaOpenApi } from '../../modules/media/presentation/openapi/media.openapi';
import {
  ERROR_BODY_SCHEMA_NAME,
  errorBodySchema,
  SESSION_COOKIE_SECURITY_SCHEME,
  toOpenApiSchema,
  type OpenApiModule,
  type OpenApiPaths,
  type OpenApiSchema,
} from '../../shared/openapi/openapi';

/** Ordem = ordem das seções no Scalar. */
export const OPENAPI_MODULES: OpenApiModule[] = [
  healthOpenApi,
  identityOpenApi,
  contentOpenApi,
  mediaOpenApi,
  auditOpenApi,
];

export type OpenApiDocumentOptions = { version: string };

export function buildOpenApiDocument(options: OpenApiDocumentOptions) {
  const paths: OpenApiPaths = {};
  const schemas: Record<string, OpenApiSchema> = {
    [ERROR_BODY_SCHEMA_NAME]: toOpenApiSchema(errorBodySchema),
  };

  for (const module of OPENAPI_MODULES) {
    for (const [path, item] of Object.entries(module.paths)) {
      if (paths[path]) {
        throw new Error(`OpenAPI path documented twice: ${path}`);
      }
      paths[path] = item;
    }
    for (const [name, schema] of Object.entries(module.schemas ?? {})) {
      if (schemas[name]) {
        throw new Error(`OpenAPI schema documented twice: ${name}`);
      }
      schemas[name] = toOpenApiSchema(schema);
    }
  }

  return {
    info: {
      title: 'Regulamente API',
      version: options.version,
      description:
        'API do portal administrativo Regulamente.\n\n' +
        `Autenticação: faça \`POST /api/v1/auth/login\`; o cookie \`${SESSION_COOKIE_NAME}\` ` +
        'é enviado automaticamente nas próximas requisições (no browser, `credentials: "include"`).\n\n' +
        'Erros seguem sempre o schema `ErrorBody` com o campo `error` estável.',
    },
    tags: OPENAPI_MODULES.map((module) => module.tag),
    paths,
    components: {
      securitySchemes: {
        [SESSION_COOKIE_SECURITY_SCHEME]: {
          type: 'apiKey',
          in: 'cookie',
          name: SESSION_COOKIE_NAME,
          description: 'Cookie opaco HttpOnly definido pelo login.',
        },
      },
      schemas,
    },
  };
}
