import { describe, expect, it } from 'bun:test';
import { createTestAuditBundle } from '../../../shared/testing/create-test-audit-bundle';
import { composeMediaService } from '../application/compose-media';
import {
  FakeMediaPlaybackProvider,
  FakeMediaUploadProvider,
  InMemoryMediaAssetRepository,
} from './fakes/in-memory-media';

const actor = {
  userId: '22222222-2222-4222-8222-222222222222',
  name: 'Ana Editor',
  role: 'editor' as const,
};

describe('MediaService', () => {
  it('creates upload response DTO with uploadUrl and lists without it', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const auditBundle = createTestAuditBundle();
    const service = composeMediaService({
      assets,
      uploadProvider,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: () => new Date('2026-07-27T15:00:00.000Z'),
      newId: () => '11111111-1111-4111-8111-111111111111',
    });

    const created = await service.createVideoUploadRequest(actor, {
      title: 'Clip',
      originalFileName: 'clip.mp4',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.uploadUrl).toBe('https://upload.example/one-time');
    expect(created.value.status).toBe('pending_upload');
    expect(created.value.kind).toBe('video');
    expect('providerRef' in created.value).toBe(false);
    expect(auditBundle.events.snapshot()[0]?.action).toBe(
      'media.video_upload_requested',
    );

    const listed = await service.list({ page: 1, pageSize: 20 });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items).toHaveLength(1);
    expect(listed.value.items[0]).not.toHaveProperty('uploadUrl');
  });

  it('getById returns not_found', async () => {
    const auditBundle = createTestAuditBundle();
    const service = composeMediaService({
      assets: new InMemoryMediaAssetRepository(),
      uploadProvider: new FakeMediaUploadProvider(),
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
    });
    const result = await service.getById(
      '99999999-9999-4999-8999-999999999999',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('creates signed playback session for ready video without audit', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const playbackProvider = new FakeMediaPlaybackProvider();
    const auditBundle = createTestAuditBundle();
    const now = new Date('2026-07-27T15:00:00.000Z');
    const service = composeMediaService({
      assets,
      uploadProvider,
      playbackProvider,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: () => now,
      newId: () => '11111111-1111-4111-8111-111111111111',
      playbackTokenTtlSeconds: 900,
    });

    const created = await service.createVideoUploadRequest(actor, {
      title: 'Clip',
      originalFileName: 'clip.mp4',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    uploadProvider.statuses.set('provider-ref-1', {
      status: 'ready',
      durationSeconds: 42,
    });

    const session = await service.createPlaybackSession(created.value.id);
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    expect(session.value.playbackUrl).toContain('/iframe');
    expect(session.value.expiresAt).toBe('2026-07-27T15:15:00.000Z');
    expect(playbackProvider.createCalls).toHaveLength(1);
    expect(playbackProvider.createCalls[0]?.providerRef).toBe('provider-ref-1');
    expect(
      auditBundle.events
        .snapshot()
        .filter((e) => e.action !== 'media.video_upload_requested'),
    ).toHaveLength(0);
  });

  it('rejects playback when asset is not ready', async () => {
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const playbackProvider = new FakeMediaPlaybackProvider();
    const auditBundle = createTestAuditBundle();
    const service = composeMediaService({
      assets,
      uploadProvider,
      playbackProvider,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: () => new Date('2026-07-27T15:00:00.000Z'),
      newId: () => '11111111-1111-4111-8111-111111111111',
    });

    const created = await service.createVideoUploadRequest(actor, {
      title: 'Clip',
      originalFileName: 'clip.mp4',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const session = await service.createPlaybackSession(created.value.id);
    expect(session.ok).toBe(false);
    if (session.ok) return;
    expect(session.error.code).toBe('CONFLICT');
    expect(playbackProvider.createCalls).toHaveLength(0);
  });
});
