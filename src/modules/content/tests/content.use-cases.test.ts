import { describe, expect, it } from 'bun:test';
import { Content } from '../core/entities/content.entity';
import { CreateContentDraftUseCase } from '../core/use-cases/create-content-draft.use-case';
import { GetContentByIdUseCase } from '../core/use-cases/get-content-by-id.use-case';
import { ListContentsUseCase } from '../core/use-cases/list-contents.use-case';
import { UpdateContentDraftUseCase } from '../core/use-cases/update-content-draft.use-case';
import { InMemoryContentRepository } from './fakes/in-memory-content.repository';

const now = new Date('2026-07-27T12:00:00.000Z');

describe('Content use-cases', () => {
  it('CreateContentDraftUseCase persists draft with author snapshot', async () => {
    const repo = new InMemoryContentRepository();
    const useCase = new CreateContentDraftUseCase({
      contents: repo,
      now: () => now,
      newId: () => 'content-uc-1',
    });

    const result = await useCase.execute({
      actor: { userId: 'user-1', name: 'Ana' },
      title: 'Draft',
      type: 'text',
      category: null,
      description: '',
      body: '',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('content-uc-1');
    expect(result.value.status).toBe('draft');
    expect(result.value.authorName).toBe('Ana');
    expect(await repo.findById('content-uc-1')).not.toBeNull();
  });

  it('GetContentByIdUseCase returns not_found when missing', async () => {
    const useCase = new GetContentByIdUseCase({
      contents: new InMemoryContentRepository(),
    });
    const result = await useCase.execute({ id: 'missing' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('ListContentsUseCase returns ordered page', async () => {
    const repo = new InMemoryContentRepository();
    repo.seed(
      Content.restore({
        id: 'a',
        title: 'A',
        type: 'text',
        category: null,
        status: 'draft',
        description: '',
        body: '',
        authorUserId: 'u',
        authorName: 'Ana',
        mediaAssetId: null,
      version: 1,
        createdAt: now,
        updatedAt: new Date('2026-07-26T10:00:00.000Z'),
      }),
    );
    repo.seed(
      Content.restore({
        id: 'b',
        title: 'B',
        type: 'text',
        category: null,
        status: 'draft',
        description: '',
        body: '',
        authorUserId: 'u',
        authorName: 'Ana',
        mediaAssetId: null,
      version: 1,
        createdAt: now,
        updatedAt: new Date('2026-07-27T10:00:00.000Z'),
      }),
    );

    const useCase = new ListContentsUseCase({ contents: repo });
    const result = await useCase.execute({ page: 1, pageSize: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('UpdateContentDraftUseCase bumps version via repository atomic path', async () => {
    const repo = new InMemoryContentRepository();
    const create = new CreateContentDraftUseCase({
      contents: repo,
      now: () => now,
      newId: () => 'upd-1',
    });
    const created = await create.execute({
      actor: { userId: 'u', name: 'Ana' },
      title: 'T',
      type: 'mixed',
      category: 'anger',
      description: '',
      body: '',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const update = new UpdateContentDraftUseCase({
      contents: repo,
      now: () => new Date('2026-07-27T13:00:00.000Z'),
    });
    const result = await update.execute({
      id: 'upd-1',
      expectedVersion: 1,
      title: 'T2',
      category: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(2);
    expect(result.value.title).toBe('T2');
    expect(result.value.category).toBeNull();
  });
});
