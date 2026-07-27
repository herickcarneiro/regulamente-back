import type { Result } from '../../../base/core/result/result';
import type { DomainError } from '../../../base/core/errors/domain.error';
import type { MediaStatus } from '../value-objects/media-status';

export type CreateDirectVideoUploadInput = {
  title: string;
  originalFileName: string;
  maxDurationSeconds: number;
  /** Absolute expiry for the one-time upload URL (provider + local policy). */
  uploadUrlExpiresAt: Date;
  /** Optional allowed embed origins forwarded to the provider. */
  allowedOrigins?: string[];
};

export type DirectVideoUpload = {
  uploadUrl: string;
  providerRef: string;
};

export type ProviderVideoStatus = {
  status: MediaStatus;
  durationSeconds: number | null;
};

/**
 * Port for direct video upload providers (e.g. Cloudflare Stream).
 * Cloudflare types must not leak into core — adapters map at the boundary.
 */
export interface MediaUploadProvider {
  createDirectVideoUpload(
    input: CreateDirectVideoUploadInput,
  ): Promise<Result<DirectVideoUpload, DomainError>>;

  getVideoStatus(
    providerRef: string,
  ): Promise<Result<ProviderVideoStatus, DomainError>>;
}
