import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type { MediaAsset } from '../entities/media-asset.entity';
import type { MediaKind } from '../value-objects/media-kind';
import type { MediaStatus } from '../value-objects/media-status';

export type MediaAssetListFilters = {
  status?: MediaStatus;
  kind?: MediaKind;
  page: number;
  pageSize: number;
};

export type MediaAssetListResult = {
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
};

export interface MediaAssetRepository {
  create(asset: MediaAsset, tx?: TransactionContext): Promise<MediaAsset>;
  findById(id: string, tx?: TransactionContext): Promise<MediaAsset | null>;
  list(filters: MediaAssetListFilters): Promise<MediaAssetListResult>;
  update(asset: MediaAsset, tx?: TransactionContext): Promise<MediaAsset>;
}
