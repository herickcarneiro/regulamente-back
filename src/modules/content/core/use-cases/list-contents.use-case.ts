import type { DomainError } from '../../../base/core/errors/domain.error';
import { ok, type Result } from '../../../base/core/result/result';
import type {
  ContentListFilters,
  ContentListResult,
  ContentRepository,
} from '../repositories/content.repository';

export type ListContentsUseCaseDeps = {
  contents: ContentRepository;
};

export class ListContentsUseCase {
  constructor(private readonly deps: ListContentsUseCaseDeps) {}

  async execute(
    filters: ContentListFilters,
  ): Promise<Result<ContentListResult, DomainError>> {
    const result = await this.deps.contents.list(filters);
    return ok(result);
  }
}
