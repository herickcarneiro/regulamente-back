import { openapi, type ElysiaOpenAPIConfig } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import packageJson from '../../../package.json';
import { buildOpenApiDocument } from './openapi-document';

export const API_DOCS_PATH = '/docs';
export const API_DOCS_SPEC_PATH = '/docs/json';

export type ApiDocsConfig = { enabled: boolean };

/**
 * Scalar em `/docs` + spec em `/docs/json`.
 * O documento vem dos módulos (`presentation/openapi`); a geração automática
 * do plugin fica desligada porque os handlers validam com Zod internamente.
 */
export function createApiDocsPlugin(config: ApiDocsConfig) {
  if (!config.enabled) {
    return new Elysia({ name: 'api-docs' });
  }

  return new Elysia({ name: 'api-docs' }).use(
    openapi({
      path: API_DOCS_PATH,
      specPath: API_DOCS_SPEC_PATH,
      provider: 'scalar',
      // Tipos próprios (shared/openapi) → tipo do plugin (openapi-types).
      documentation: buildOpenApiDocument({
        version: packageJson.version,
      }) as ElysiaOpenAPIConfig['documentation'],
      exclude: { paths: [/.*/] },
      scalar: {
        hideClientButton: true,
        defaultOpenAllTags: true,
      },
    }),
  );
}
