import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, type Result } from '../../../base/core/result/result';
import { MediaNotReadyForPlaybackError } from '../errors/media.errors';
import type { MediaPlaybackProvider } from '../repositories/media-playback.provider';
import type { GetMediaAssetByIdUseCase } from './get-media-asset-by-id.use-case';

export type CreatePlaybackSessionInput = {
  id: string;
};

export type PlaybackSession = {
  playbackUrl: string;
  expiresAt: Date;
};

export type CreatePlaybackSessionUseCaseDeps = {
  getMediaAssetById: GetMediaAssetByIdUseCase;
  playbackProvider: MediaPlaybackProvider;
  now: () => Date;
  tokenTtlSeconds: number;
};

/**
 * Administrative signed playback. Provider call stays outside any Postgres TX.
 */
export class CreatePlaybackSessionUseCase {
  constructor(private readonly deps: CreatePlaybackSessionUseCaseDeps) {}

  async execute(
    input: CreatePlaybackSessionInput,
  ): Promise<Result<PlaybackSession, DomainError>> {
    const asset = await this.deps.getMediaAssetById.execute(input.id);
    if (!asset.ok) {
      return asset;
    }
    if (asset.value.kind !== 'video' || asset.value.status !== 'ready') {
      return fail(new MediaNotReadyForPlaybackError());
    }

    const expiresAt = new Date(
      this.deps.now().getTime() + this.deps.tokenTtlSeconds * 1000,
    );
    return this.deps.playbackProvider.createSignedPlayback({
      providerRef: asset.value.providerRef,
      expiresAt,
    });
  }
}
