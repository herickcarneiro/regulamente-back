import { composeAuditService } from '../modules/audit/application/compose-audit';
import type { AuditService } from '../modules/audit/application/services/audit.service';
import { DrizzleAuditEventRepository } from '../modules/audit/infrastructure/repositories/drizzle-audit-event.repository';
import { composeContentService } from '../modules/content/application/compose-content';
import type { ContentService } from '../modules/content/application/services/content.service';
import { MediaServiceContentMediaCatalog } from '../modules/content/infrastructure/acl/media-service-content-media-catalog';
import { DrizzleContentRepository } from '../modules/content/infrastructure/repositories/drizzle-content.repository';
import { IdentityService } from '../modules/identity/application/services/identity.service';
import { BunPasswordHasher } from '../modules/identity/infrastructure/crypto/bun-password-hasher';
import { Sha256TokenService } from '../modules/identity/infrastructure/crypto/sha256-token-service';
import { DrizzleAdminUserRepository } from '../modules/identity/infrastructure/repositories/drizzle-admin-user.repository';
import { DrizzleSessionRepository } from '../modules/identity/infrastructure/repositories/drizzle-session.repository';
import { composeMediaService } from '../modules/media/application/compose-media';
import type { MediaService } from '../modules/media/application/services/media.service';
import type { MediaPlaybackProvider } from '../modules/media/core/repositories/media-playback.provider';
import type { MediaUploadProvider } from '../modules/media/core/repositories/media-upload.provider';
import {
  CloudflareStreamPlaybackProvider,
  UnavailableMediaPlaybackProvider,
} from '../modules/media/infrastructure/providers/cloudflare-stream-playback.provider';
import {
  CloudflareStreamUploadProvider,
  UnavailableMediaUploadProvider,
} from '../modules/media/infrastructure/providers/cloudflare-stream-upload.provider';
import { DrizzleMediaAssetRepository } from '../modules/media/infrastructure/repositories/drizzle-media-asset.repository';
import { shouldUseSecureCookies } from './config/cookie-security';
import { loadEnv, parseCorsOrigins, type Env } from './config/env';
import { parseCloudflareStreamAllowedOrigins } from './config/parse-cloudflare-stream-allowed-origins';
import { createApp, type App } from './create-app';
import {
  createDatabase,
  type DatabaseHandle,
} from './persistence/database';
import { DrizzleUnitOfWork } from './persistence/drizzle-unit-of-work';

export type ComposedApp = {
  app: App;
  env: Env;
  database: DatabaseHandle;
  identityService: IdentityService;
  contentService: ContentService;
  mediaService: MediaService;
  auditService: AuditService;
};

function parseAllowedOrigins(value: string | undefined): string[] | undefined {
  return parseCloudflareStreamAllowedOrigins(value);
}

export function composeMediaUploadProvider(env: Env): MediaUploadProvider {
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    return new CloudflareStreamUploadProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      apiBase: env.CLOUDFLARE_STREAM_API_BASE,
      timeoutMs: env.CLOUDFLARE_STREAM_TIMEOUT_MS,
      allowedOrigins: parseAllowedOrigins(env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS),
    });
  }
  return new UnavailableMediaUploadProvider();
}

/** Playback requires customer code; upload may work without it. */
export function composeMediaPlaybackProvider(env: Env): MediaPlaybackProvider {
  if (
    env.CLOUDFLARE_ACCOUNT_ID &&
    env.CLOUDFLARE_API_TOKEN &&
    env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim()
  ) {
    return new CloudflareStreamPlaybackProvider({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
      apiBase: env.CLOUDFLARE_STREAM_API_BASE,
      timeoutMs: env.CLOUDFLARE_STREAM_TIMEOUT_MS,
    });
  }
  return new UnavailableMediaPlaybackProvider();
}

export function composeApp(
  source: Record<string, string | undefined> = process.env,
): ComposedApp {
  const env = loadEnv(source);
  const database = createDatabase(env.DATABASE_URL);
  const unitOfWork = new DrizzleUnitOfWork(database.db);
  const auditService = composeAuditService({
    events: new DrizzleAuditEventRepository(database.db),
  });

  const identityService = new IdentityService({
    users: new DrizzleAdminUserRepository(database.db),
    sessions: new DrizzleSessionRepository(database.db),
    passwords: new BunPasswordHasher(),
    tokens: new Sha256TokenService(),
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    audit: auditService,
    unitOfWork,
  });

  const mediaService = composeMediaService({
    assets: new DrizzleMediaAssetRepository(database.db),
    uploadProvider: composeMediaUploadProvider(env),
    playbackProvider: composeMediaPlaybackProvider(env),
    audit: auditService,
    unitOfWork,
    maxDurationSeconds: env.MEDIA_MAX_DURATION_SECONDS,
    uploadUrlTtlSeconds: env.MEDIA_UPLOAD_URL_TTL_SECONDS,
    playbackTokenTtlSeconds: env.MEDIA_PLAYBACK_TOKEN_TTL_SECONDS,
  });

  const contentService = composeContentService({
    contents: new DrizzleContentRepository(database.db),
    mediaCatalog: new MediaServiceContentMediaCatalog(mediaService),
    audit: auditService,
    unitOfWork,
  });

  const app = createApp({
    identityService,
    contentService,
    mediaService,
    auditService,
    sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    secureCookies: shouldUseSecureCookies(env),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    httpLog: {
      enabled: env.HTTP_LOG_ENABLED,
      color: env.HTTP_LOG_COLOR,
    },
  });

  return {
    app,
    env,
    database,
    identityService,
    contentService,
    mediaService,
    auditService,
  };
}
