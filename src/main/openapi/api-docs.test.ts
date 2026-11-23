import { describe, expect, it } from 'bun:test';
import { createTestApp } from '../../shared/testing/create-test-app';
import { loadEnv } from '../config/env';
import { API_DOCS_PATH, API_DOCS_SPEC_PATH } from './api-docs.plugin';
import { buildOpenApiDocument } from './openapi-document';

const DATABASE_URL =
  'postgres://regulamente:regulamente@127.0.0.1:54329/regulamente';

type Spec = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  components: { schemas: Record<string, unknown> };
};

/** `/api/v1/contents/:id` → `/api/v1/contents/{id}`; sem barra final. */
function toOpenApiPath(path: string): string {
  const withoutTrailingSlash =
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return withoutTrailingSlash.replace(/:([^/]+)/g, '{$1}');
}

function registeredOperations(): string[] {
  const { app } = createTestApp();
  return app.routes
    .filter((route) => route.method !== 'OPTIONS')
    .map(
      (route) => `${route.method.toLowerCase()} ${toOpenApiPath(route.path)}`,
    )
    .sort();
}

function documentedOperations(): string[] {
  const { paths } = buildOpenApiDocument({ version: 'test' });
  return Object.entries(paths)
    .flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method} ${path}`),
    )
    .sort();
}

describe('OpenAPI document', () => {
  it('documents exactly the routes registered on the app', () => {
    expect(documentedOperations()).toEqual(registeredOperations());
  });

  it('references only declared component schemas', () => {
    const document = buildOpenApiDocument({ version: 'test' });
    const refs = [
      ...JSON.stringify(document).matchAll(/#\/components\/schemas\/(\w+)/g),
    ].map((match) => match[1]);

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(Object.keys(document.components.schemas)).toContain(ref!);
    }
  });

  it('documents 401 on every route that requires a session', () => {
    const { paths } = buildOpenApiDocument({ version: 'test' });
    for (const item of Object.values(paths)) {
      for (const operation of Object.values(item)) {
        const security = operation!.security;
        // `[]` = pública; `{}` na lista = sessão opcional (ex.: logout).
        const optional = security.some((req) => Object.keys(req).length === 0);
        if (security.length === 0 || optional) continue;
        expect(Object.keys(operation!.responses)).toContain('401');
      }
    }
  });
});

describe('API docs routes', () => {
  it('serves the OpenAPI 3.1 spec when enabled', async () => {
    const { app } = createTestApp({ apiDocsEnabled: true });
    const response = await app.handle(
      new Request(`http://localhost${API_DOCS_SPEC_PATH}`),
    );

    expect(response.status).toBe(200);
    const spec = (await response.json()) as Spec;
    expect(spec.openapi).toStartWith('3.1.');
    expect(spec.info.title).toBe('Regulamente API');
    expect(Object.keys(spec.paths).sort()).toEqual(
      Object.keys(buildOpenApiDocument({ version: 'test' }).paths).sort(),
    );
    expect(spec.paths[API_DOCS_PATH]).toBeUndefined();
    expect(spec.components.schemas['ErrorBody']).toBeDefined();
  });

  it('serves the Scalar page when enabled', async () => {
    const { app } = createTestApp({ apiDocsEnabled: true });
    const response = await app.handle(
      new Request(`http://localhost${API_DOCS_PATH}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('scalar');
  });

  it('does not expose docs when disabled', async () => {
    const { app } = createTestApp({ apiDocsEnabled: false });
    for (const path of [API_DOCS_PATH, API_DOCS_SPEC_PATH]) {
      const response = await app.handle(new Request(`http://localhost${path}`));
      expect(response.status).toBe(404);
    }
  });
});

describe('API_DOCS_ENABLED', () => {
  it('defaults to enabled outside production', () => {
    expect(loadEnv({ NODE_ENV: 'development', DATABASE_URL }).API_DOCS_ENABLED).toBe(true);
    expect(loadEnv({ NODE_ENV: 'test', DATABASE_URL }).API_DOCS_ENABLED).toBe(true);
  });

  it('defaults to disabled in production', () => {
    expect(loadEnv({ NODE_ENV: 'production', DATABASE_URL }).API_DOCS_ENABLED).toBe(false);
  });

  it('can be overridden explicitly', () => {
    expect(
      loadEnv({ NODE_ENV: 'production', DATABASE_URL, API_DOCS_ENABLED: 'true' })
        .API_DOCS_ENABLED,
    ).toBe(true);
    expect(
      loadEnv({ NODE_ENV: 'development', DATABASE_URL, API_DOCS_ENABLED: 'false' })
        .API_DOCS_ENABLED,
    ).toBe(false);
  });
});
