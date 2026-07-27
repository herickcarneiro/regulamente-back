import type { DomainError } from '../../../base/core/errors/domain.error';
import { ok, type Result } from '../../../base/core/result/result';
import type {
  MediaAssetListFilters,
  MediaAssetListResult,
  MediaAssetRepository,
} from '../repositories/media-asset.repository';

export type ListMediaAssetsDeps = {
  assets: MediaAssetRepository;
};

export class ListMediaAssetsUseCase {
  constructor(private readonly deps: ListMediaAssetsDeps) {}

  async execute(
    filters: MediaAssetListFilters,
  ): Promise<Result<MediaAssetListResult, DomainError>> {
    const result = await this.deps.assets.list(filters);
    return ok(result);
  }
}
