import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../../../main/persistence/database';
import { resolveDb } from '../../../../main/persistence/resolve-db';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type { MediaAsset } from '../../core/entities/media-asset.entity';
import type {
  MediaAssetListFilters,
  MediaAssetListResult,
  MediaAssetRepository,
} from '../../core/repositories/media-asset.repository';
import { MediaAssetMapper } from '../mappers/media-asset.mapper';
import { mediaAssets } from '../persistence/media-assets.schema';

export class DrizzleMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly db: Database) {}

  async create(
    asset: MediaAsset,
    tx?: TransactionContext,
  ): Promise<MediaAsset> {
    const db = resolveDb(this.db, tx);
    const row = MediaAssetMapper.toPersistence(asset);
    const rows = await db.insert(mediaAssets).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Failed to insert media asset');
    }
    return MediaAssetMapper.toDomain(created);
  }

  async findById(
    id: string,
    tx?: TransactionContext,
  ): Promise<MediaAsset | null> {
    const db = resolveDb(this.db, tx);
    const rows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    const row = rows[0];
    return row ? MediaAssetMapper.toDomain(row) : null;
  }

  async list(filters: MediaAssetListFilters): Promise<MediaAssetListResult> {
    const where = this.buildWhere(filters);

    const totalRows = await this.db
      .select({ value: count() })
      .from(mediaAssets)
      .where(where);
    const total = Number(totalRows[0]?.value ?? 0);

    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.db
      .select()
      .from(mediaAssets)
      .where(where)
      .orderBy(desc(mediaAssets.updatedAt), asc(mediaAssets.id))
      .limit(filters.pageSize)
      .offset(offset);

    return {
      items: rows.map((row) => MediaAssetMapper.toDomain(row)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async update(
    asset: MediaAsset,
    tx?: TransactionContext,
  ): Promise<MediaAsset> {
    const db = resolveDb(this.db, tx);
    const rows = await db
      .update(mediaAssets)
      .set({
        title: asset.title,
        originalFileName: asset.originalFileName,
        kind: asset.kind,
        status: asset.status,
        durationSeconds: asset.durationSeconds,
        providerRef: asset.providerRef,
        uploadExpiresAt: asset.uploadExpiresAt,
        updatedAt: asset.updatedAt,
      })
      .where(eq(mediaAssets.id, asset.id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error('Failed to update media asset');
    }
    return MediaAssetMapper.toDomain(updated);
  }

  private buildWhere(filters: MediaAssetListFilters): SQL | undefined {
    const parts: SQL[] = [];
    if (filters.status) {
      parts.push(eq(mediaAssets.status, filters.status));
    }
    if (filters.kind) {
      parts.push(eq(mediaAssets.kind, filters.kind));
    }
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return and(...parts);
  }
}
