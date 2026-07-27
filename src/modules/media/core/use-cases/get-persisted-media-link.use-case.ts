import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import type { MediaAssetRepository } from '../repositories/media-asset.repository';
import { MediaNotFoundError } from '../errors/media.errors';

export type PersistedMediaLinkView = {
  id: string;
  kind: string;
  status: string;
};

export type GetPersistedMediaLinkDeps = {
  assets: MediaAssetRepository;
};

/**
 * Narrow read for Content link eligibility — persisted row only.
 * No provider reconciliation (avoids collapsing provider errors into not_found).
 */
export class GetPersistedMediaLinkUseCase {
  constructor(private readonly deps: GetPersistedMediaLinkDeps) {}

  async execute(
    id: string,
  ): Promise<Result<PersistedMediaLinkView, DomainError>> {
    const asset = await this.deps.assets.findById(id);
    if (!asset) {
      return fail(new MediaNotFoundError());
    }
    return ok({
      id: asset.id,
      kind: asset.kind,
      status: asset.status,
    });
  }
}
