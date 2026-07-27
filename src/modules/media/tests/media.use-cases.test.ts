import { describe, expect, it } from 'bun:test';
import { CreateVideoUploadRequestUseCase } from '../core/use-cases/create-video-upload-request.use-case';
import { GetMediaAssetByIdUseCase } from '../core/use-cases/get-media-asset-by-id.use-case';
import { ListMediaAssetsUseCase } from '../core/use-cases/list-media-assets.use-case';
import {
  FakeMediaUploadProvider,
  InMemoryMediaAssetRepository,
} from './fakes/in-memory-media';

const TTL = 900;
const MAX_DURATION = 900;

function createUseCase(options?: {
  assets?: InMemoryMediaAssetRepository;
  uploadProvider?: FakeMediaUploadProvider;
  now?: () => Date;
  newId?: () => string;
}) {
  return new CreateVideoUploadRequestUseCase({
    assets: options?.assets ?? new InMemoryMediaAssetRepository(),
    uploadProvider: options?.uploadProvider ?? new FakeMediaUploadProvider(),
    now: options?.now ?? (() => new Date('2026-07-27T15:00:00.000Z')),
    newId:
      options?.newId ?? (() => '11111111-1111-4111-8111-111111111111'),
    maxDurationSeconds: MAX_DURATION,
    uploadUrlTtlSeconds: TTL,
  });
}

describe('Media use-cases', () => {
  it('creates video upload request via provider then persists asset', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    uploadProvider.nextUpload = {
      uploadUrl: 'https://upload.example/a',
      providerRef: 'ref-a',
    };

    const useCase = createUseCase({ assets, uploadProvider });

    const result = await useCase.execute({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      createdByUserId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.uploadUrl).toBe('https://upload.example/a');
    expect(result.value.asset.status).toBe('pending_upload');
    expect(result.value.asset.providerRef).toBe('ref-a');
    expect(result.value.asset.uploadExpiresAt.toISOString()).toBe(
      '2026-07-27T15:15:00.000Z',
    );
    expect(uploadProvider.createCalls[0]).toMatchObject({
      maxDurationSeconds: 900,
      uploadUrlExpiresAt: new Date('2026-07-27T15:15:00.000Z'),
    });
    expect(await assets.findById(result.value.asset.id)).not.toBeNull();
  });

  it('does not call provider when metadata is invalid', async () => {
    const uploadProvider = new FakeMediaUploadProvider();
    const useCase = createUseCase({ uploadProvider });

    const result = await useCase.execute({
      title: '   ',
      originalFileName: 'clip.mp4',
      createdByUserId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(uploadProvider.createCalls).toHaveLength(0);
  });

  it('fails create when provider is unavailable', async () => {
    const uploadProvider = new FakeMediaUploadProvider();
    uploadProvider.available = false;
    const useCase = createUseCase({ uploadProvider });

    const result = await useCase.execute({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      createdByUserId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEDIA_PROVIDER_UNAVAILABLE');
  });

  it('lists with status filter and reconciles detail from provider', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const created = await createUseCase({ assets, uploadProvider }).execute({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      createdByUserId: '22222222-2222-4222-8222-222222222222',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    uploadProvider.statuses.set(created.value.asset.providerRef, {
      status: 'ready',
      durationSeconds: 42,
    });

    const list = new ListMediaAssetsUseCase({ assets });
    const listed = await list.execute({ page: 1, pageSize: 20 });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.total).toBe(1);
    expect(listed.value.items[0]?.status).toBe('pending_upload');

    const get = new GetMediaAssetByIdUseCase({
      assets,
      uploadProvider,
      now: () => new Date('2026-07-27T15:00:00.000Z'),
    });
    const detail = await get.execute(created.value.asset.id);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.status).toBe('ready');
    expect(detail.value.durationSeconds).toBe(42);
  });

  it('reconciles expired pending_upload to failed without calling provider', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const created = await createUseCase({
      assets,
      uploadProvider,
      now: () => new Date('2026-07-27T15:00:00.000Z'),
    }).execute({
      title: 'Clip',
      originalFileName: 'clip.mp4',
      createdByUserId: '22222222-2222-4222-8222-222222222222',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    uploadProvider.getStatusCalls = [];
    const get = new GetMediaAssetByIdUseCase({
      assets,
      uploadProvider,
      now: () => new Date('2026-07-27T15:15:00.000Z'),
    });
    const detail = await get.execute(created.value.asset.id);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.status).toBe('failed');
    expect(uploadProvider.getStatusCalls).toHaveLength(0);
  });

  it('returns not_found for missing id', async () => {
    const get = new GetMediaAssetByIdUseCase({
      assets: new InMemoryMediaAssetRepository(),
      uploadProvider: new FakeMediaUploadProvider(),
    });
    const result = await get.execute('99999999-9999-4999-8999-999999999999');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});
