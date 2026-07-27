import { Content } from '../../core/entities/content.entity';
import type { ContentStatus } from '../../core/value-objects/content-status';
import type { ContentType } from '../../core/value-objects/content-type';
import type { EmotionCategory } from '../../core/value-objects/emotion-category';
import type { ContentRow } from '../persistence/contents.schema';

export const ContentMapper = {
  toDomain(row: ContentRow): Content {
    return Content.restore({
      id: row.id,
      title: row.title,
      type: row.type as ContentType,
      category: (row.category as EmotionCategory | null) ?? null,
      status: row.status as ContentStatus,
      description: row.description,
      body: row.body,
      authorUserId: row.authorUserId,
      authorName: row.authorName,
      mediaAssetId: row.mediaAssetId ?? null,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(content: Content): ContentRow {
    return {
      id: content.id,
      title: content.title,
      type: content.type,
      category: content.category,
      status: content.status,
      description: content.description,
      body: content.body,
      authorUserId: content.authorUserId,
      authorName: content.authorName,
      mediaAssetId: content.mediaAssetId,
      version: content.version,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  },
};
