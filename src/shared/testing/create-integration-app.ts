import { composeAuditService } from '../../modules/audit/application/compose-audit';
import { DrizzleAuditEventRepository } from '../../modules/audit/infrastructure/repositories/drizzle-audit-event.repository';
import { composeContentService } from '../../modules/content/application/compose-content';
import { MediaServiceContentMediaCatalog } from '../../modules/content/infrastructure/acl/media-service-content-media-catalog';
import { DrizzleContentRepository } from '../../modules/content/infrastructure/repositories/drizzle-content.repository';
import { IdentityService } from '../../modules/identity/application/services/identity.service';
import { BunPasswordHasher } from '../../modules/identity/infrastructure/crypto/bun-password-hasher';
import { Sha256TokenService } from '../../modules/identity/infrastructure/crypto/sha256-token-service';
import type { AdminUserRepository } from '../../modules/identity/core/repositories/admin-user.repository';
import { DrizzleSessionRepository } from '../../modules/identity/infrastructure/repositories/drizzle-session.repository';
import { composeMediaService } from '../../modules/media/application/compose-media';
import type { MediaPlaybackProvider } from '../../modules/media/core/repositories/media-playback.provider';
import type { MediaUploadProvider } from '../../modules/media/core/repositories/media-upload.provider';
import { DrizzleMediaAssetRepository } from '../../modules/media/infrastructure/repositories/drizzle-media-asset.repository';
import { createApp, type App } from '../../main/create-app';
import type { Database } from '../../main/persistence/database';
import { DrizzleUnitOfWork } from '../../main/persistence/drizzle-unit-of-work';

export function createIntegrationApp(options: {
  db: Database;
  users: AdminUserRepository;
  uploadProvider: MediaUploadProvider;
  playbackProvider?: MediaPlaybackProvider;
  passwords?: BunPasswordHasher;
}): {
  app: App;
  identityService: IdentityService;
  auditEvents: DrizzleAuditEventRepository;
  unitOfWork: DrizzleUnitOfWork;
} {
  const unitOfWork = new DrizzleUnitOfWork(options.db);
  const auditEvents = new DrizzleAuditEventRepository(options.db);
  const auditService = composeAuditService({ events: auditEvents });
  const passwords = options.passwords ?? new BunPasswordHasher();

  const identityService = new IdentityService({
    users: options.users,
    sessions: new DrizzleSessionRepository(options.db),
    passwords,
    tokens: new Sha256TokenService(),
    sessionTtlSeconds: 28800,
    audit: auditService,
    unitOfWork,
  });

  const mediaService = composeMediaService({
    assets: new DrizzleMediaAssetRepository(options.db),
    uploadProvider: options.uploadProvider,
    playbackProvider: options.playbackProvider,
    audit: auditService,
    unitOfWork,
  });

  const app = createApp({
    identityService,
    contentService: composeContentService({
      contents: new DrizzleContentRepository(options.db),
      mediaCatalog: new MediaServiceContentMediaCatalog(mediaService),
      audit: auditService,
      unitOfWork,
    }),
    mediaService,
    auditService,
    sessionTtlSeconds: 28800,
    secureCookies: false,
    corsOrigins: ['http://localhost:5176'],
  });

  return { app, identityService, auditEvents, unitOfWork };
}
