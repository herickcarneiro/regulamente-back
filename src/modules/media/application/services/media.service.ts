import type { DomainError } from '../../../base/core/errors/domain.error';
import { ok, type Result } from '../../../base/core/result/result';
import type { AuditService } from '../../../audit/application/services/audit.service';
import { runAtomic } from '../../../../shared/persistence/run-atomic';
import type { UnitOfWork } from '../../../../shared/persistence/unit-of-work';
import type { MediaAsset } from '../../core/entities/media-asset.entity';
import type { MediaAssetListFilters } from '../../core/repositories/media-asset.repository';
import type { CreatePlaybackSessionUseCase } from '../../core/use-cases/create-playback-session.use-case';
import type { CreateVideoUploadRequestUseCase } from '../../core/use-cases/create-video-upload-request.use-case';
import type { GetMediaAssetByIdUseCase } from '../../core/use-cases/get-media-asset-by-id.use-case';
import type {
  GetPersistedMediaLinkUseCase,
  PersistedMediaLinkView,
} from '../../core/use-cases/get-persisted-media-link.use-case';
import type { ListMediaAssetsUseCase } from '../../core/use-cases/list-media-assets.use-case';
import type {
  CreateVideoUploadRequestDto,
  CreateVideoUploadResponseDto,
  MediaActor,
  MediaAssetDetailDto,
  MediaAssetListItemDto,
  MediaAssetListResponseDto,
  PlaybackSessionDto,
} from '../dtos/media.dto';

export type MediaServiceDeps = {
  createVideoUploadRequest: CreateVideoUploadRequestUseCase;
  getMediaAssetById: GetMediaAssetByIdUseCase;
  getPersistedMediaLink: GetPersistedMediaLinkUseCase;
  listMediaAssets: ListMediaAssetsUseCase;
  createPlaybackSession: CreatePlaybackSessionUseCase;
  audit: AuditService;
  unitOfWork: UnitOfWork;
};

export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  async createVideoUploadRequest(
    actor: MediaActor,
    input: CreateVideoUploadRequestDto,
  ): Promise<Result<CreateVideoUploadResponseDto, DomainError>> {
    // External provider call stays outside the Postgres transaction.
    const prepared = await this.deps.createVideoUploadRequest.prepare({
      title: input.title,
      originalFileName: input.originalFileName,
      createdByUserId: actor.userId,
    });
    if (!prepared.ok) {
      return prepared;
    }

    return runAtomic(this.deps.unitOfWork, async (tx) => {
      const saved = await this.deps.createVideoUploadRequest.persist(
        prepared.value,
        {
          createdByUserId: actor.userId,
          tx,
        },
      );
      if (!saved.ok) {
        return saved;
      }

      const audit = await this.deps.audit.append(
        {
          actorUserId: actor.userId,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'media.video_upload_requested',
          targetType: 'media_asset',
          targetId: saved.value.asset.id,
          targetLabel: saved.value.asset.title,
        },
        tx,
      );
      if (!audit.ok) {
        return audit;
      }

      return ok({
        ...this.toDetailDto(saved.value.asset),
        uploadUrl: saved.value.uploadUrl,
      });
    });
  }

  async getById(
    id: string,
  ): Promise<Result<MediaAssetDetailDto, DomainError>> {
    const result = await this.deps.getMediaAssetById.execute(id);
    if (!result.ok) {
      return result;
    }
    return ok(this.toDetailDto(result.value));
  }

  /**
   * Persisted row only — for Content link ACL. No provider reconciliation.
   */
  async getPersistedLinkView(
    id: string,
  ): Promise<Result<PersistedMediaLinkView, DomainError>> {
    return this.deps.getPersistedMediaLink.execute(id);
  }

  async list(
    filters: MediaAssetListFilters,
  ): Promise<Result<MediaAssetListResponseDto, DomainError>> {
    const result = await this.deps.listMediaAssets.execute(filters);
    if (!result.ok) {
      return result;
    }
    return ok({
      items: result.value.items.map((item) => this.toListItemDto(item)),
      total: result.value.total,
      page: result.value.page,
      pageSize: result.value.pageSize,
    });
  }

  /** Signed preview URL — no TX, no audit, never persists token/URL. */
  async createPlaybackSession(
    id: string,
  ): Promise<Result<PlaybackSessionDto, DomainError>> {
    const result = await this.deps.createPlaybackSession.execute({ id });
    if (!result.ok) {
      return result;
    }
    return ok({
      playbackUrl: result.value.playbackUrl,
      expiresAt: result.value.expiresAt.toISOString(),
    });
  }

  private toListItemDto(asset: MediaAsset): MediaAssetListItemDto {
    return {
      id: asset.id,
      title: asset.title,
      originalFileName: asset.originalFileName,
      kind: asset.kind,
      status: asset.status,
      durationSeconds: asset.durationSeconds,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  private toDetailDto(asset: MediaAsset): MediaAssetDetailDto {
    return this.toListItemDto(asset);
  }
}
