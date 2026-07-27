import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import type { Content } from '../entities/content.entity';
import { ContentNotFoundError } from '../errors/content.errors';
import type { ContentRepository } from '../repositories/content.repository';

export type GetContentByIdUseCaseDeps = {
  contents: ContentRepository;
};

export class GetContentByIdUseCase {
  constructor(private readonly deps: GetContentByIdUseCaseDeps) {}

  async execute(input: {
    id: string;
  }): Promise<Result<Content, DomainError>> {
    const content = await this.deps.contents.findById(input.id);
    if (!content) {
      return fail(new ContentNotFoundError());
    }
    return ok(content);
  }
}
