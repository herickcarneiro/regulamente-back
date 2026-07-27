import type { DomainError } from '../../../base/core/errors/domain.error';
import type { Result } from '../../../base/core/result/result';
import type { MediaService } from '../../../media/application/services/media.service';
import type {
  ContentMediaAssetView,
  ContentMediaCatalog,
} from '../../core/repositories/content-media-catalog';

/**
 * ACL at composition: Media application narrow persisted read → Content port.
 * Does not use getById (no provider reconcile). Propagates NOT_FOUND vs other errors.
 */
export class MediaServiceContentMediaCatalog implements ContentMediaCatalog {
  constructor(private readonly media: MediaService) {}

  async findById(
    id: string,
  ): Promise<Result<ContentMediaAssetView, DomainError>> {
    return this.media.getPersistedLinkView(id);
  }
}
