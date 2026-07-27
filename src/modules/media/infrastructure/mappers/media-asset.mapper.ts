import { MediaAsset } from '../../core/entities/media-asset.entity';
import type { MediaKind } from '../../core/value-objects/media-kind';
import type { MediaStatus } from '../../core/value-objects/media-status';
import type { MediaAssetRow } from '../persistence/media-assets.schema';

export const MediaAssetMapper = {
  toDomain(row: MediaAssetRow): MediaAsset {
    return MediaAsset.restore({
      id: row.id,
      title: row.title,
      originalFileName: row.originalFileName,
      kind: row.kind as MediaKind,
      status: row.status as MediaStatus,
      durationSeconds: row.durationSeconds,
      providerRef: row.providerRef,
      uploadExpiresAt: row.uploadExpiresAt,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(asset: MediaAsset): MediaAssetRow {
    return {
      id: asset.id,
      title: asset.title,
      originalFileName: asset.originalFileName,
      kind: asset.kind,
      status: asset.status,
      durationSeconds: asset.durationSeconds,
      providerRef: asset.providerRef,
      uploadExpiresAt: asset.uploadExpiresAt,
      createdByUserId: asset.createdByUserId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  },
};
