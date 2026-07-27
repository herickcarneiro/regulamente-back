import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import type { MediaAsset } from '../entities/media-asset.entity';
import { MediaNotFoundError } from '../errors/media.errors';
import type { MediaAssetRepository } from '../repositories/media-asset.repository';
import type { MediaUploadProvider } from '../repositories/media-upload.provider';

export type GetMediaAssetByIdDeps = {
  assets: MediaAssetRepository;
  uploadProvider: MediaUploadProvider;
  now?: () => Date;
};

export class GetMediaAssetByIdUseCase {
  private readonly now: () => Date;

  constructor(private readonly deps: GetMediaAssetByIdDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async execute(id: string): Promise<Result<MediaAsset, DomainError>> {
    const asset = await this.deps.assets.findById(id);
    if (!asset) {
      return fail(new MediaNotFoundError());
    }

    const now = this.now();
    const abandoned = asset.markAbandonedIfExpired(now);
    if (abandoned) {
      const saved = await this.deps.assets.update(abandoned);
      return ok(saved);
    }

    if (!asset.needsProviderReconciliation()) {
      return ok(asset);
    }

    const snapshot = await this.deps.uploadProvider.getVideoStatus(
      asset.providerRef,
    );
    if (!snapshot.ok) {
      // Detail still returns local state when provider is flaky.
      return ok(asset);
    }

    const reconciled = asset.reconcileFromProvider(snapshot.value, now);
    if (!reconciled.ok) {
      return fail(reconciled.error);
    }

    if (reconciled.value === asset) {
      return ok(asset);
    }

    const saved = await this.deps.assets.update(reconciled.value);
    return ok(saved);
  }
}
