import { describe, expect, it } from 'bun:test';
import { createTestAuditBundle } from '../../../shared/testing/create-test-audit-bundle';
import { composeContentService } from '../application/compose-content';
import { Content } from '../core/entities/content.entity';
import { InMemoryContentMediaCatalog } from './fakes/in-memory-content-media-catalog';
import { InMemoryContentRepository } from './fakes/in-memory-content.repository';

const now = new Date('2026-07-27T12:00:00.000Z');
const actor = {
  userId: 'user-1',
  name: 'Ana Editor',
  role: 'editor' as const,
};
const READY_MEDIA_ID = '11111111-1111-4111-8111-111111111111';

function createService(
  repo = new InMemoryContentRepository(),
  mediaCatalog = new InMemoryContentMediaCatalog(),
) {
  let seq = 0;
  const auditBundle = createTestAuditBundle({
    now: () => now,
    newId: () => `audit-${++seq}`,
  });
  return {
    repo,
    mediaCatalog,
    events: auditBundle.events,
    service: composeContentService({
      contents: repo,
      mediaCatalog,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
      now: () => now,
      newId: () => `content-${++seq}`,
    }),
  };
}

describe('ContentService (use-cases + DTO mapping)', () => {
  it('creates draft with session author snapshot and audit event', async () => {
    const { service, events } = createService();
    const result = await service.createDraft(actor, {
      title: 'Novo',
      type: 'text',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: 'content-1',
      title: 'Novo',
      status: 'draft',
      version: 1,
      authorUserId: 'user-1',
      authorName: 'Ana Editor',
      description: '',
      body: '',
    });
    expect(events.snapshot()).toHaveLength(1);
    expect(events.snapshot()[0]?.action).toBe('content.draft_created');
  });

  it('lists with q filter on title or authorName and stable order', async () => {
    const { repo, service } = createService();
    const older = Content.restore({
      id: 'a',
      title: 'Alpha',
      type: 'text',
      category: null,
      status: 'draft',
      description: '',
      body: '',
      authorUserId: 'u1',
      authorName: 'Bruno',
      mediaAssetId: null,
      version: 1,
      createdAt: new Date('2026-07-26T10:00:00.000Z'),
      updatedAt: new Date('2026-07-26T10:00:00.000Z'),
    });
    const newer = Content.restore({
      id: 'b',
      title: 'Beta tip',
      type: 'video',
      category: 'anxiety',
      status: 'draft',
      description: '',
      body: '',
      authorUserId: 'u2',
      authorName: 'Carla',
      mediaAssetId: null,
      version: 1,
      createdAt: new Date('2026-07-27T10:00:00.000Z'),
      updatedAt: new Date('2026-07-27T10:00:00.000Z'),
    });
    repo.seed(older);
    repo.seed(newer);

    const byTitle = await service.list({ page: 1, pageSize: 20, q: 'beta' });
    expect(byTitle.ok).toBe(true);
    if (!byTitle.ok) return;
    expect(byTitle.value.items.map((i) => i.id)).toEqual(['b']);

    const byAuthor = await service.list({ page: 1, pageSize: 20, q: 'bruno' });
    expect(byAuthor.ok).toBe(true);
    if (!byAuthor.ok) return;
    expect(byAuthor.value.items.map((i) => i.id)).toEqual(['a']);

    const all = await service.list({ page: 1, pageSize: 20 });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.value.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(all.value.items[0]).not.toHaveProperty('body');
    expect(all.value.items[0]).not.toHaveProperty('description');
  });

  it('returns not_found for missing content', async () => {
    const { service } = createService();
    const result = await service.getById('missing');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('updates draft atomically and bumps version with audit', async () => {
    const { service, events } = createService();
    const created = await service.createDraft(actor, {
      title: 'Draft',
      type: 'mixed',
      category: 'anger',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await service.updateDraft(actor, created.value.id, {
      expectedVersion: 1,
      title: 'Draft v2',
      category: null,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.version).toBe(2);
    expect(updated.value.title).toBe('Draft v2');
    expect(updated.value.category).toBeNull();
    expect(
      events.snapshot().map((event) => event.action),
    ).toEqual(['content.draft_created', 'content.draft_updated']);
  });

  it('maps version conflict and not editable distinctly in domain codes', async () => {
    const { repo, service, events } = createService();
    const published = Content.restore({
      id: 'pub-1',
      title: 'Live',
      type: 'text',
      category: null,
      status: 'published',
      description: '',
      body: '',
      authorUserId: 'u1',
      authorName: 'Ana',
      mediaAssetId: null,
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
    repo.seed(published);

    const notEditable = await service.updateDraft(actor, 'pub-1', {
      expectedVersion: 2,
      title: 'Nope',
    });
    expect(notEditable.ok).toBe(false);
    if (notEditable.ok) return;
    expect(notEditable.error.code).toBe('CONTENT_NOT_EDITABLE');

    const draft = await service.createDraft(actor, {
      title: 'D',
      type: 'text',
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const stale = await service.updateDraft(actor, draft.value.id, {
      expectedVersion: 99,
      title: 'Stale',
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe('VERSION_CONFLICT');
    expect(
      events.snapshot().filter((event) => event.action === 'content.draft_updated'),
    ).toHaveLength(0);
  });

  it('links ready video mediaAssetId on create and detail', async () => {
    const catalog = new InMemoryContentMediaCatalog();
    catalog.seed({ id: READY_MEDIA_ID, kind: 'video', status: 'ready' });
    const { service } = createService(undefined, catalog);

    const result = await service.createDraft(actor, {
      title: 'Com mídia',
      type: 'video',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mediaAssetId).toBe(READY_MEDIA_ID);

    const detail = await service.getById(result.value.id);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.mediaAssetId).toBe(READY_MEDIA_ID);
    expect(detail.value).not.toHaveProperty('providerRef');
  });

  it('rejects unknown mediaAssetId with not_found before persist', async () => {
    const { service, repo } = createService();
    const result = await service.createDraft(actor, {
      title: 'Órfão',
      type: 'video',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
    expect(await repo.list({ page: 1, pageSize: 10 })).toMatchObject({
      total: 0,
    });
  });

  it('rejects non-ready mediaAssetId with conflict', async () => {
    const catalog = new InMemoryContentMediaCatalog();
    catalog.seed({
      id: READY_MEDIA_ID,
      kind: 'video',
      status: 'processing',
    });
    const { service } = createService(undefined, catalog);
    const result = await service.createDraft(actor, {
      title: 'Cedo',
      type: 'video',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
  });

  it('unlinks mediaAssetId with null and preserves when omitted', async () => {
    const catalog = new InMemoryContentMediaCatalog();
    catalog.seed({ id: READY_MEDIA_ID, kind: 'video', status: 'ready' });
    const { service } = createService(undefined, catalog);

    const created = await service.createDraft(actor, {
      title: 'Link',
      type: 'mixed',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const preserved = await service.updateDraft(actor, created.value.id, {
      expectedVersion: 1,
      title: 'Link v2',
    });
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    expect(preserved.value.mediaAssetId).toBe(READY_MEDIA_ID);

    const cleared = await service.updateDraft(actor, created.value.id, {
      expectedVersion: 2,
      mediaAssetId: null,
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.mediaAssetId).toBeNull();
  });

  it('rejects text|audio + mediaAssetId with INVALID_INPUT before catalog', async () => {
    const catalog = new InMemoryContentMediaCatalog();
    catalog.seed({ id: READY_MEDIA_ID, kind: 'video', status: 'ready' });
    const { service } = createService(undefined, catalog);

    const created = await service.createDraft(actor, {
      title: 'Texto com mídia',
      type: 'text',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('INVALID_INPUT');
    expect(catalog.findByIdCalls).toHaveLength(0);

    const draft = await service.createDraft(actor, {
      title: 'Só texto',
      type: 'text',
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const patched = await service.updateDraft(actor, draft.value.id, {
      expectedVersion: 1,
      type: 'audio',
      mediaAssetId: READY_MEDIA_ID,
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) return;
    expect(patched.error.code).toBe('INVALID_INPUT');
    expect(catalog.findByIdCalls).toHaveLength(0);
  });

  it('allows video|mixed draft without mediaAssetId', async () => {
    const catalog = new InMemoryContentMediaCatalog();
    const { service } = createService(undefined, catalog);
    const video = await service.createDraft(actor, {
      title: 'Vídeo sem mídia',
      type: 'video',
    });
    expect(video.ok).toBe(true);
    if (!video.ok) return;
    expect(video.value.mediaAssetId).toBeNull();
    expect(catalog.findByIdCalls).toHaveLength(0);
  });
});
