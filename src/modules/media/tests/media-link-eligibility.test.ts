import { describe, expect, it } from 'bun:test';
import { MediaAsset } from '../core/entities/media-asset.entity';
import { GetPersistedMediaLinkUseCase } from '../core/use-cases/get-persisted-media-link.use-case';
import {
  FakeMediaUploadProvider,
  InMemoryMediaAssetRepository,
} from './fakes/in-memory-media';
import { MediaServiceContentMediaCatalog } from '../../content/infrastructure/acl/media-service-content-media-catalog';
import { assertLinkableMediaAsset } from '../../content/core/use-cases/assert-linkable-media-asset';
import { composeMediaService } from '../application/compose-media';
import { createTestAuditBundle } from '../../../shared/testing/create-test-audit-bundle';

const now = new Date('2026-07-27T15:00:00.000Z');
const ASSET_ID = '11111111-1111-4111-8111-111111111111';

function seedPending(assets: InMemoryMediaAssetRepository) {
  const created = MediaAsset.createVideoUpload({
    id: ASSET_ID,
    title: 'Pending',
    originalFileName: 'p.mp4',
    providerRef: 'ref-1',
    uploadExpiresAt: new Date('2026-07-27T16:00:00.000Z'),
    createdByUserId: '22222222-2222-4222-8222-222222222222',
    now,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  assets.seed(created.value);
}

describe('GetPersistedMediaLinkUseCase / ACL eligibility', () => {
  it('returns not_found for unknown id', async () => {
    const useCase = new GetPersistedMediaLinkUseCase({
      assets: new InMemoryMediaAssetRepository(),
    });
    const result = await useCase.execute(ASSET_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('returns persisted pending without calling upload provider', async () => {
    const assets = new InMemoryMediaAssetRepository();
    seedPending(assets);
    const uploadProvider = new FakeMediaUploadProvider();
    uploadProvider.available = false;

    const useCase = new GetPersistedMediaLinkUseCase({ assets });
    const result = await useCase.execute(ASSET_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('pending_upload');
    expect(uploadProvider.getStatusCalls).toHaveLength(0);
  });

  it('ACL: unknown→not_found, persisted pending→conflict, ready→ok', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    uploadProvider.available = false;
    const auditBundle = createTestAuditBundle();
    const media = composeMediaService({
      assets,
      uploadProvider,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: () => now,
    });
    const catalog = new MediaServiceContentMediaCatalog(media);

    const unknown = await assertLinkableMediaAsset(catalog, ASSET_ID);
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.error.code).toBe('NOT_FOUND');

    seedPending(assets);
    const pending = await assertLinkableMediaAsset(catalog, ASSET_ID);
    expect(pending.ok).toBe(false);
    if (pending.ok) return;
    expect(pending.error.code).toBe('CONFLICT');
    expect(uploadProvider.getStatusCalls).toHaveLength(0);

    const readyAsset = MediaAsset.restore({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Ready',
      originalFileName: 'r.mp4',
      kind: 'video',
      status: 'ready',
      durationSeconds: 10,
      providerRef: 'ref-ready',
      uploadExpiresAt: new Date('2026-07-27T16:00:00.000Z'),
      createdByUserId: '22222222-2222-4222-8222-222222222222',
      createdAt: now,
      updatedAt: now,
    });
    assets.seed(readyAsset);
    const ready = await assertLinkableMediaAsset(catalog, readyAsset.id);
    expect(ready.ok).toBe(true);
    expect(uploadProvider.getStatusCalls).toHaveLength(0);
  });
});
