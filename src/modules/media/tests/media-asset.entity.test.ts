import { describe, expect, it } from 'bun:test';
import { MediaAsset } from '../core/entities/media-asset.entity';

describe('MediaAsset entity', () => {
  const base = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Intro session',
    originalFileName: 'intro.mp4',
    providerRef: 'cf-uid-1',
    createdByUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    now: new Date('2026-07-27T15:00:00.000Z'),
    uploadExpiresAt: new Date('2026-07-27T15:15:00.000Z'),
  };

  it('creates a video asset in pending_upload', () => {
    const result = MediaAsset.createVideoUpload(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('video');
    expect(result.value.status).toBe('pending_upload');
    expect(result.value.durationSeconds).toBeNull();
    expect(result.value.title).toBe('Intro session');
    expect(result.value.originalFileName).toBe('intro.mp4');
    expect(result.value.providerRef).toBe('cf-uid-1');
    expect(result.value.uploadExpiresAt.toISOString()).toBe(
      '2026-07-27T15:15:00.000Z',
    );
  });

  it('rejects empty title', () => {
    const result = MediaAsset.createVideoUpload({ ...base, title: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects empty originalFileName', () => {
    const result = MediaAsset.createVideoUpload({
      ...base,
      originalFileName: '',
    });
    expect(result.ok).toBe(false);
  });

  it('reconciles provider status to processing and ready', () => {
    const created = MediaAsset.createVideoUpload(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const processing = created.value.reconcileFromProvider(
      { status: 'processing', durationSeconds: null },
      new Date('2026-07-27T15:01:00.000Z'),
    );
    expect(processing.ok).toBe(true);
    if (!processing.ok) return;
    expect(processing.value.status).toBe('processing');

    const ready = processing.value.reconcileFromProvider(
      {
        status: 'ready',
        durationSeconds: 125,
      },
      new Date('2026-07-27T15:02:00.000Z'),
    );
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.value.status).toBe('ready');
    expect(ready.value.durationSeconds).toBe(125);
  });

  it('does not regress from ready to pending_upload', () => {
    const ready = MediaAsset.restore({
      id: base.id,
      title: base.title,
      originalFileName: base.originalFileName,
      kind: 'video',
      status: 'ready',
      durationSeconds: 10,
      providerRef: base.providerRef,
      createdByUserId: base.createdByUserId,
      uploadExpiresAt: base.uploadExpiresAt,
      createdAt: base.now,
      updatedAt: base.now,
    });

    const result = ready.reconcileFromProvider(
      { status: 'pending_upload', durationSeconds: null },
      new Date('2026-07-27T16:00:00.000Z'),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('ready');
    expect(result.value.updatedAt).toEqual(base.now);
  });

  it('marks expired pending_upload as failed', () => {
    const created = MediaAsset.createVideoUpload(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const abandoned = created.value.markAbandonedIfExpired(
      new Date('2026-07-27T15:15:00.000Z'),
    );
    expect(abandoned).not.toBeNull();
    expect(abandoned?.status).toBe('failed');
  });

  it('does not abandon pending_upload before expiry', () => {
    const created = MediaAsset.createVideoUpload(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const abandoned = created.value.markAbandonedIfExpired(
      new Date('2026-07-27T15:14:59.000Z'),
    );
    expect(abandoned).toBeNull();
  });
});
