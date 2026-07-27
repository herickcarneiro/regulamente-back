import { fail, ok, type Result } from '../../../base/core/result/result';
import type { DomainError } from '../../../base/core/errors/domain.error';
import {
  LinkedMediaNotFoundError,
  LinkedMediaNotReadyError,
} from '../errors/content.errors';
import type { ContentMediaCatalog } from '../repositories/content-media-catalog';

/**
 * Validates that a mediaAssetId may be linked to Content.
 * Call before the Content+Audit transaction.
 * Propagates catalog domain errors (does not collapse internal → not_found).
 */
export async function assertLinkableMediaAsset(
  catalog: ContentMediaCatalog,
  mediaAssetId: string,
): Promise<Result<void, DomainError>> {
  const asset = await catalog.findById(mediaAssetId);
  if (!asset.ok) {
    if (asset.error.code === 'NOT_FOUND') {
      return fail(new LinkedMediaNotFoundError());
    }
    return asset;
  }
  if (asset.value.kind !== 'video' || asset.value.status !== 'ready') {
    return fail(new LinkedMediaNotReadyError());
  }
  return ok(undefined);
}
