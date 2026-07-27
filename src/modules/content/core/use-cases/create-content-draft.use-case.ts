import type { DomainError } from '../../../base/core/errors/domain.error';
import type { Result } from '../../../base/core/result/result';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import { Content } from '../entities/content.entity';
import type { ContentRepository } from '../repositories/content.repository';
import type { ContentType } from '../value-objects/content-type';
import type { EmotionCategory } from '../value-objects/emotion-category';

export type CreateContentDraftInput = {
  actor: { userId: string; name: string };
  title: string;
  type: ContentType;
  category: EmotionCategory | null;
  description: string;
  body: string;
  mediaAssetId?: string | null;
  tx?: TransactionContext;
};

export type CreateContentDraftUseCaseDeps = {
  contents: ContentRepository;
  now: () => Date;
  newId: () => string;
};

export class CreateContentDraftUseCase {
  constructor(private readonly deps: CreateContentDraftUseCaseDeps) {}

  async execute(
    input: CreateContentDraftInput,
  ): Promise<Result<Content, DomainError>> {
    const created = Content.createDraft({
      id: this.deps.newId(),
      title: input.title,
      type: input.type,
      category: input.category,
      description: input.description,
      body: input.body,
      authorUserId: input.actor.userId,
      authorName: input.actor.name,
      mediaAssetId: input.mediaAssetId ?? null,
      now: this.deps.now(),
    });
    if (!created.ok) {
      return created;
    }
    const saved = await this.deps.contents.create(created.value, input.tx);
    return { ok: true, value: saved };
  }
}
