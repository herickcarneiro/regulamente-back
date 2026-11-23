import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { DomainError } from '../modules/base/core/errors/domain.error';
import {
  domainErrorBody,
  mapDomainErrorToStatus,
} from '../modules/base/presentation/errors/map-domain-error';
import type { AuditService } from '../modules/audit/application/services/audit.service';
import { createAuditRoutes } from '../modules/audit/presentation/routes/audit.routes';
import type { ContentService } from '../modules/content/application/services/content.service';
import { createContentRoutes } from '../modules/content/presentation/routes/content.routes';
import { createHealthRoutes } from '../modules/health/presentation/health.routes';
import type { IdentityService } from '../modules/identity/application/services/identity.service';
import { createIdentityRoutes } from '../modules/identity/presentation/routes/identity.routes';
import type { MediaService } from '../modules/media/application/services/media.service';
import { createMediaRoutes } from '../modules/media/presentation/routes/media.routes';
import {
  createHttpLogPlugin,
  type HttpLogPluginConfig,
} from '../shared/observability/http-log-plugin';
import { sanitizeValidationError } from './errors/sanitize-validation-error';
import { createApiDocsPlugin, type ApiDocsConfig } from './openapi/api-docs.plugin';

export type CreateAppDeps = {
  identityService: IdentityService;
  contentService: ContentService;
  mediaService: MediaService;
  auditService: AuditService;
  sessionTtlSeconds: number;
  secureCookies: boolean;
  corsOrigins: string[];
  httpLog?: HttpLogPluginConfig;
  apiDocs?: ApiDocsConfig;
};

export function createApp(deps: CreateAppDeps) {
  const httpLog: HttpLogPluginConfig = deps.httpLog ?? {
    enabled: false,
    color: false,
  };

  return new Elysia()
    .use(
      cors({
        origin: deps.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
      }),
    )
    .use(createHttpLogPlugin(httpLog))
    .onError(({ error, set, code }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return {
          error: 'not_found',
          message: 'Not found',
        };
      }

      if (error instanceof DomainError) {
        set.status = mapDomainErrorToStatus(error);
        return domainErrorBody(error);
      }

      const validationError = error as {
        code?: string;
        message?: string;
        all?: unknown;
      };

      if (code === 'VALIDATION' || validationError.code === 'VALIDATION') {
        set.status = 400;
        return sanitizeValidationError(validationError);
      }

      set.status = 500;
      return {
        error: 'internal',
        message: 'Unexpected error',
      };
    })
    .use(createApiDocsPlugin(deps.apiDocs ?? { enabled: false }))
    .use(createHealthRoutes())
    .use(
      createIdentityRoutes({
        identityService: deps.identityService,
        sessionTtlSeconds: deps.sessionTtlSeconds,
        secureCookies: deps.secureCookies,
      }),
    )
    .use(
      createContentRoutes({
        contentService: deps.contentService,
        identityService: deps.identityService,
      }),
    )
    .use(
      createMediaRoutes({
        mediaService: deps.mediaService,
        identityService: deps.identityService,
      }),
    )
    .use(
      createAuditRoutes({
        auditService: deps.auditService,
        identityService: deps.identityService,
      }),
    );
}

export type App = ReturnType<typeof createApp>;
