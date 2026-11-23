import { createApp, type App } from '../../main/create-app';
import { composeContentService } from '../../modules/content/application/compose-content';
import { InMemoryContentRepository } from '../../modules/content/tests/fakes/in-memory-content.repository';
import { InMemoryContentMediaCatalog } from '../../modules/content/tests/fakes/in-memory-content-media-catalog';
import { IdentityService } from '../../modules/identity/application/services/identity.service';
import {
  FakePasswordHasher,
  FakeTokenService,
  InMemoryAdminUserRepository,
  InMemorySessionRepository,
} from '../../modules/identity/tests/fakes/in-memory-identity';
import { composeMediaService } from '../../modules/media/application/compose-media';
import {
  FakeMediaPlaybackProvider,
  FakeMediaUploadProvider,
  InMemoryMediaAssetRepository,
} from '../../modules/media/tests/fakes/in-memory-media';
import { createTestAuditBundle } from './create-test-audit-bundle';

export type CreateTestAppOptions = {
  users?: InMemoryAdminUserRepository;
  contents?: InMemoryContentRepository;
  assets?: InMemoryMediaAssetRepository;
  mediaCatalog?: InMemoryContentMediaCatalog;
  uploadProvider?: FakeMediaUploadProvider;
  playbackProvider?: FakeMediaPlaybackProvider;
  now?: () => Date;
  newId?: () => string;
  httpLogEnabled?: boolean;
  apiDocsEnabled?: boolean;
};

export function createTestApp(options: CreateTestAppOptions = {}): {
  app: App;
  users: InMemoryAdminUserRepository;
  contents: InMemoryContentRepository;
  assets: InMemoryMediaAssetRepository;
  mediaCatalog: InMemoryContentMediaCatalog;
  uploadProvider: FakeMediaUploadProvider;
  playbackProvider: FakeMediaPlaybackProvider;
  identityService: IdentityService;
  events: ReturnType<typeof createTestAuditBundle>['events'];
} {
  const users = options.users ?? new InMemoryAdminUserRepository();
  const contents = options.contents ?? new InMemoryContentRepository();
  const assets = options.assets ?? new InMemoryMediaAssetRepository();
  const mediaCatalog =
    options.mediaCatalog ?? new InMemoryContentMediaCatalog();
  const uploadProvider =
    options.uploadProvider ?? new FakeMediaUploadProvider();
  const playbackProvider =
    options.playbackProvider ?? new FakeMediaPlaybackProvider();
  const auditBundle = createTestAuditBundle({
    now: options.now,
  });

  const identityService = new IdentityService({
    users,
    sessions: new InMemorySessionRepository(),
    passwords: new FakePasswordHasher(),
    tokens: new FakeTokenService(),
    sessionTtlSeconds: 28800,
    audit: auditBundle.audit,
    unitOfWork: auditBundle.unitOfWork,
  });

  const mediaService = composeMediaService({
    assets,
    uploadProvider,
    playbackProvider,
    audit: auditBundle.audit,
    unitOfWork: auditBundle.unitOfWork,
    now: options.now,
    newId: options.newId,
  });

  const app = createApp({
    identityService,
    contentService: composeContentService({
      contents,
      mediaCatalog,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: options.now,
      newId: options.newId,
    }),
    mediaService,
    auditService: auditBundle.audit,
    sessionTtlSeconds: 28800,
    secureCookies: false,
    corsOrigins: ['http://localhost:5176'],
    httpLog: {
      enabled: options.httpLogEnabled ?? false,
      color: false,
    },
    apiDocs: { enabled: options.apiDocsEnabled ?? false },
  });

  return {
    app,
    users,
    contents,
    assets,
    mediaCatalog,
    uploadProvider,
    playbackProvider,
    identityService,
    events: auditBundle.events,
  };
}
