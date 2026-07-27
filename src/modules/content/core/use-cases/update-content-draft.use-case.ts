import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, type Result } from '../../../base/core/result/result';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type { Content } from '../entities/content.entity';
import { ContentNotFoundError } from '../errors/content.errors';
import type { ContentRepository } from '../repositories/content.repository';
import type { ContentType } from '../value-objects/content-type';
import type { EmotionCategory } from '../value-objects/emotion-category';

export type UpdateContentDraftInput = {
  id: string;
  expectedVersion: number;
  title?: string;
  description?: string;
  body?: string;
  type?: ContentType;
  category?: EmotionCategory | null;
  mediaAssetId?: string | null;
  tx?: TransactionContext;
};

export type UpdateContentDraftUseCaseDeps = {
  contents: ContentRepository;
  now: () => Date;
};

export class UpdateContentDraftUseCase {
  constructor(private readonly deps: UpdateContentDraftUseCaseDeps) {}

  async execute(
    input: UpdateContentDraftInput,
  ): Promise<Result<Content, DomainError>> {
    const current = await this.deps.contents.findById(input.id, input.tx);
    if (!current) {
      return fail(new ContentNotFoundError());
    }

    const next = current.applyDraftUpdate(
      {
        expectedVersion: input.expectedVersion,
        title: input.title,
        description: input.description,
        body: input.body,
        type: input.type,
        category: input.category,
        mediaAssetId: input.mediaAssetId,
      },
      this.deps.now(),
    );
    if (!next.ok) {
      return next;
    }

    return this.deps.contents.updateDraftAtomic(
      next.value,
      input.expectedVersion,
      input.tx,
    );
  }
}
