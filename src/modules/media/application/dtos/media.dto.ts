import type { AuditActorRole } from '../../../audit/core/value-objects/audit-actor-role';
import type { MediaKind } from '../../core/value-objects/media-kind';
import type { MediaStatus } from '../../core/value-objects/media-status';

export type MediaActor = {
  userId: string;
  name: string;
  role: AuditActorRole;
};

export type MediaAssetListItemDto = {
  id: string;
  title: string;
  originalFileName: string;
  kind: MediaKind;
  status: MediaStatus;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaAssetDetailDto = MediaAssetListItemDto;

export type CreateVideoUploadRequestDto = {
  title: string;
  originalFileName: string;
};

export type CreateVideoUploadResponseDto = MediaAssetDetailDto & {
  uploadUrl: string;
};

export type MediaAssetListResponseDto = {
  items: MediaAssetListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type PlaybackSessionDto = {
  playbackUrl: string;
  expiresAt: string;
};
