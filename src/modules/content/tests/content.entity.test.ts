import { describe, expect, it } from 'bun:test';
import { Content } from '../core/entities/content.entity';

const baseNow = new Date('2026-07-27T12:00:00.000Z');

function createDraft() {
  return Content.createDraft({
    id: 'content-1',
    title: 'Respiração guiada',
    type: 'video',
    category: 'anxiety',
    description: 'Desc',
    body: 'Body',
    authorUserId: 'user-1',
    authorName: 'Ana Editor',
    now: baseNow,
  });
}

describe('Content entity (draft-only invariants)', () => {
  it('creates draft with version 1 and forced draft status', () => {
    const result = createDraft();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe('draft');
    expect(result.value.version).toBe(1);
    expect(result.value.authorUserId).toBe('user-1');
    expect(result.value.authorName).toBe('Ana Editor');
    expect(result.value.createdAt).toEqual(baseNow);
    expect(result.value.updatedAt).toEqual(baseNow);
  });

  it('rejects empty title on create', () => {
    const result = Content.createDraft({
      id: 'content-1',
      title: '   ',
      type: 'text',
      category: null,
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      now: baseNow,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('applies draft update bumping version and updatedAt', () => {
    const created = createDraft();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const later = new Date('2026-07-27T13:00:00.000Z');
    const updated = created.value.applyDraftUpdate(
      { title: 'Novo título', expectedVersion: 1 },
      later,
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.title).toBe('Novo título');
    expect(updated.value.version).toBe(2);
    expect(updated.value.updatedAt).toEqual(later);
    expect(updated.value.authorName).toBe('Ana Editor');
    expect(updated.value.status).toBe('draft');
  });

  it('rejects update when expectedVersion mismatches', () => {
    const created = createDraft();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = created.value.applyDraftUpdate(
      { title: 'X', expectedVersion: 99 },
      baseNow,
    );
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.error.code).toBe('VERSION_CONFLICT');
  });

  it('rejects update when status is not draft', () => {
    const published = Content.restore({
      id: 'content-2',
      title: 'Published',
      type: 'text',
      category: null,
      status: 'published',
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      mediaAssetId: null,
      version: 3,
      createdAt: baseNow,
      updatedAt: baseNow,
    });

    const updated = published.applyDraftUpdate(
      { title: 'Hack', expectedVersion: 3 },
      baseNow,
    );
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.error.code).toBe('CONTENT_NOT_EDITABLE');
  });

  it('clears category when patch sets null', () => {
    const created = createDraft();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = created.value.applyDraftUpdate(
      { category: null, expectedVersion: 1 },
      baseNow,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.category).toBeNull();
  });

  it('creates draft with optional mediaAssetId when type accepts video', () => {
    const result = Content.createDraft({
      id: 'content-1',
      title: 'Com vídeo',
      type: 'video',
      category: null,
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
      now: baseNow,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mediaAssetId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('rejects mediaAssetId when type is text or audio', () => {
    const text = Content.createDraft({
      id: 'content-1',
      title: 'Texto',
      type: 'text',
      category: null,
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
      now: baseNow,
    });
    expect(text.ok).toBe(false);
    if (text.ok) return;
    expect(text.error.code).toBe('INVALID_INPUT');
  });

  it('rejects changing type to text while mediaAssetId remains', () => {
    const created = Content.createDraft({
      id: 'content-1',
      title: 'Vídeo',
      type: 'video',
      category: null,
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
      now: baseNow,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = created.value.applyDraftUpdate(
      { type: 'text', expectedVersion: 1 },
      baseNow,
    );
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.error.code).toBe('INVALID_INPUT');
  });

  it('clears mediaAssetId when patch sets null', () => {
    const created = Content.createDraft({
      id: 'content-1',
      title: 'Vídeo',
      type: 'video',
      category: null,
      description: '',
      body: '',
      authorUserId: 'user-1',
      authorName: 'Ana',
      mediaAssetId: '11111111-1111-4111-8111-111111111111',
      now: baseNow,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = created.value.applyDraftUpdate(
      { mediaAssetId: null, expectedVersion: 1 },
      baseNow,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.mediaAssetId).toBeNull();
  });
});
