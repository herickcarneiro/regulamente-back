import type { AuditActorRole } from '../../../audit/core/value-objects/audit-actor-role';
import type { ContentStatus } from '../../core/value-objects/content-status';
import type { ContentType } from '../../core/value-objects/content-type';
import type { EmotionCategory } from '../../core/value-objects/emotion-category';

export type ContentListItemDto = {
  id: string;
  title: string;
  type: ContentType;
  category: EmotionCategory | null;
  status: ContentStatus;
  authorName: string;
  updatedAt: string;
  version: number;
};

export type ContentDetailDto = ContentListItemDto & {
  description: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  mediaAssetId: string | null;
};

export type ContentListResponseDto = {
  items: ContentListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateContentDraftDto = {
  title: string;
  description?: string;
  body?: string;
  type: ContentType;
  category?: EmotionCategory | null;
  mediaAssetId?: string | null;
};

export type UpdateContentDraftDto = {
  expectedVersion: number;
  title?: string;
  description?: string;
  body?: string;
  type?: ContentType;
  category?: EmotionCategory | null;
  /** Omit preserves; null removes. */
  mediaAssetId?: string | null;
};

export type ContentActor = {
  userId: string;
  name: string;
  role: AuditActorRole;
};
