import type { Result } from '../../../base/core/result/result';
import type { DomainError } from '../../../base/core/errors/domain.error';

export type CreateSignedPlaybackInput = {
  providerRef: string;
  /** Absolute expiry for the signed playback token. */
  expiresAt: Date;
};

export type SignedPlayback = {
  playbackUrl: string;
  expiresAt: Date;
};

/**
 * Port for short-lived signed playback URLs.
 * Segregated from MediaUploadProvider — upload may work without playback config.
 */
export interface MediaPlaybackProvider {
  createSignedPlayback(
    input: CreateSignedPlaybackInput,
  ): Promise<Result<SignedPlayback, DomainError>>;
}
