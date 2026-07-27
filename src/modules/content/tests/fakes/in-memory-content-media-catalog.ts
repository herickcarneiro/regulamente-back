import type {
  ContentMediaAssetView,
  ContentMediaCatalog,
} from '../../core/repositories/content-media-catalog';
import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import { LinkedMediaNotFoundError } from '../../core/errors/content.errors';

export class InMemoryContentMediaCatalog implements ContentMediaCatalog {
  private readonly items = new Map<string, ContentMediaAssetView>();
  findByIdCalls: string[] = [];

  seed(asset: ContentMediaAssetView): void {
    this.items.set(asset.id, asset);
  }

  async findById(
    id: string,
  ): Promise<Result<ContentMediaAssetView, DomainError>> {
    this.findByIdCalls.push(id);
    const asset = this.items.get(id);
    if (!asset) {
      return fail(new LinkedMediaNotFoundError());
    }
    return ok(asset);
  }
}
