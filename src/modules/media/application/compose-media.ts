import type { AuditService } from '../../audit/application/services/audit.service';
import type { UnitOfWork } from '../../../shared/persistence/unit-of-work';
import type { MediaAssetRepository } from '../core/repositories/media-asset.repository';
import type { MediaPlaybackProvider } from '../core/repositories/media-playback.provider';
import type { MediaUploadProvider } from '../core/repositories/media-upload.provider';
import { CreatePlaybackSessionUseCase } from '../core/use-cases/create-playback-session.use-case';
import { CreateVideoUploadRequestUseCase } from '../core/use-cases/create-video-upload-request.use-case';
import { GetMediaAssetByIdUseCase } from '../core/use-cases/get-media-asset-by-id.use-case';
import { GetPersistedMediaLinkUseCase } from '../core/use-cases/get-persisted-media-link.use-case';
import { ListMediaAssetsUseCase } from '../core/use-cases/list-media-assets.use-case';
import { UnavailableMediaPlaybackProvider } from '../infrastructure/providers/cloudflare-stream-playback.provider';
import { MediaService } from './services/media.service';

/** v1 explicit defaults — not silent 3600. Overridable via env in composition. */
export const MEDIA_V1_MAX_DURATION_SECONDS = 900;
export const MEDIA_V1_UPLOAD_URL_TTL_SECONDS = 900;
export const MEDIA_V1_PLAYBACK_TOKEN_TTL_SECONDS = 900;

export type ComposeMediaOptions = {
  assets: MediaAssetRepository;
  uploadProvider: MediaUploadProvider;
  playbackProvider?: MediaPlaybackProvider;
  audit: AuditService;
  unitOfWork: UnitOfWork;
  maxDurationSeconds?: number;
  uploadUrlTtlSeconds?: number;
  playbackTokenTtlSeconds?: number;
  now?: () => Date;
  newId?: () => string;
};

export function composeMediaService(options: ComposeMediaOptions): MediaService {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const maxDurationSeconds =
    options.maxDurationSeconds ?? MEDIA_V1_MAX_DURATION_SECONDS;
  const uploadUrlTtlSeconds =
    options.uploadUrlTtlSeconds ?? MEDIA_V1_UPLOAD_URL_TTL_SECONDS;
  const playbackTokenTtlSeconds =
    options.playbackTokenTtlSeconds ?? MEDIA_V1_PLAYBACK_TOKEN_TTL_SECONDS;
  const playbackProvider =
    options.playbackProvider ?? new UnavailableMediaPlaybackProvider();

  const getMediaAssetById = new GetMediaAssetByIdUseCase({
    assets: options.assets,
    uploadProvider: options.uploadProvider,
    now,
  });

  return new MediaService({
    createVideoUploadRequest: new CreateVideoUploadRequestUseCase({
      assets: options.assets,
      uploadProvider: options.uploadProvider,
      now,
      newId,
      maxDurationSeconds,
      uploadUrlTtlSeconds,
    }),
    getMediaAssetById,
    getPersistedMediaLink: new GetPersistedMediaLinkUseCase({
      assets: options.assets,
    }),
    listMediaAssets: new ListMediaAssetsUseCase({ assets: options.assets }),
    createPlaybackSession: new CreatePlaybackSessionUseCase({
      getMediaAssetById,
      playbackProvider,
      now,
      tokenTtlSeconds: playbackTokenTtlSeconds,
    }),
    audit: options.audit,
    unitOfWork: options.unitOfWork,
  });
}
