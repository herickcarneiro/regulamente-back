import { fail, ok, type Result } from '../../../base/core/result/result';
import type { DomainError } from '../../../base/core/errors/domain.error';
import { MediaProviderUnavailableError } from '../../core/errors/media.errors';
import type {
  CreateDirectVideoUploadInput,
  DirectVideoUpload,
  MediaUploadProvider,
  ProviderVideoStatus,
} from '../../core/repositories/media-upload.provider';
import type { MediaStatus } from '../../core/value-objects/media-status';

/** Default Cloudflare Stream HTTP timeout (ms). Overridable via config/env. */
export const CLOUDFLARE_STREAM_DEFAULT_TIMEOUT_MS = 10_000;

export type CloudflareStreamConfig = {
  accountId: string;
  apiToken: string;
  apiBase?: string;
  /** Explicit request timeout for create/status. Must be > 0. */
  timeoutMs?: number;
  /** Optional allowed origins for requireSignedURLs embeds. */
  allowedOrigins?: string[];
  fetchImpl?: typeof fetch;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

/**
 * Cloudflare Stream adapter. Maps provider payloads to domain statuses;
 * Cloudflare types stay inside this file.
 */
export class CloudflareStreamUploadProvider implements MediaUploadProvider {
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: CloudflareStreamConfig) {
    this.apiBase =
      config.apiBase ?? 'https://api.cloudflare.com/client/v4';
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? CLOUDFLARE_STREAM_DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error('CloudflareStreamUploadProvider timeoutMs must be > 0');
    }
  }

  async createDirectVideoUpload(
    input: CreateDirectVideoUploadInput,
  ): Promise<Result<DirectVideoUpload, DomainError>> {
    try {
      const origins =
        input.allowedOrigins ?? this.config.allowedOrigins ?? [];
      const response = await this.fetchWithTimeout(
        `${this.apiBase}/accounts/${this.config.accountId}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds: input.maxDurationSeconds,
            expiry: input.uploadUrlExpiresAt.toISOString(),
            meta: {
              name: input.title,
              originalFileName: input.originalFileName,
            },
            requireSignedURLs: true,
            ...(origins.length > 0 ? { allowedOrigins: origins } : {}),
          }),
        },
      );

      if (!response.ok) {
        return fail(new MediaProviderUnavailableError());
      }

      const payload = (await response.json()) as CloudflareEnvelope<{
        uploadURL: string;
        uid: string;
      }>;

      if (!payload.success || !payload.result?.uploadURL || !payload.result.uid) {
        return fail(new MediaProviderUnavailableError());
      }

      return ok({
        uploadUrl: payload.result.uploadURL,
        providerRef: payload.result.uid,
      });
    } catch {
      return fail(new MediaProviderUnavailableError());
    }
  }

  async getVideoStatus(
    providerRef: string,
  ): Promise<Result<ProviderVideoStatus, DomainError>> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBase}/accounts/${this.config.accountId}/stream/${providerRef}`,
        {
          headers: {
            authorization: `Bearer ${this.config.apiToken}`,
          },
        },
      );

      if (!response.ok) {
        return fail(new MediaProviderUnavailableError());
      }

      const payload = (await response.json()) as CloudflareEnvelope<{
        duration?: number;
        status?: { state?: string };
      }>;

      if (!payload.success || !payload.result) {
        return fail(new MediaProviderUnavailableError());
      }

      const state = payload.result.status?.state ?? 'pendingupload';
      return ok({
        status: mapCloudflareState(state),
        durationSeconds:
          typeof payload.result.duration === 'number' &&
          Number.isFinite(payload.result.duration)
            ? Math.round(payload.result.duration)
            : null,
      });
    } catch {
      return fail(new MediaProviderUnavailableError());
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class UnavailableMediaUploadProvider implements MediaUploadProvider {
  async createDirectVideoUpload(
    _input: CreateDirectVideoUploadInput,
  ): Promise<Result<DirectVideoUpload, DomainError>> {
    return fail(new MediaProviderUnavailableError());
  }

  async getVideoStatus(
    _providerRef: string,
  ): Promise<Result<ProviderVideoStatus, DomainError>> {
    return fail(new MediaProviderUnavailableError());
  }
}

function mapCloudflareState(state: string): MediaStatus {
  switch (state) {
    case 'ready':
      return 'ready';
    case 'error':
      return 'failed';
    case 'pendingupload':
      return 'pending_upload';
    case 'downloading':
    case 'queued':
    case 'inprogress':
      return 'processing';
    default:
      return 'processing';
  }
}
