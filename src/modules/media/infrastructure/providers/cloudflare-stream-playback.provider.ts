import { fail, ok, type Result } from '../../../base/core/result/result';
import type { DomainError } from '../../../base/core/errors/domain.error';
import { MediaProviderUnavailableError } from '../../core/errors/media.errors';
import type {
  CreateSignedPlaybackInput,
  MediaPlaybackProvider,
  SignedPlayback,
} from '../../core/repositories/media-playback.provider';

export type CloudflareStreamPlaybackConfig = {
  accountId: string;
  apiToken: string;
  /** Customer subdomain code (without "customer-" prefix). */
  customerCode: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

/**
 * Cloudflare Stream signed-token adapter for administrative preview.
 * Separated from upload provider so upload works without customer code.
 */
export class CloudflareStreamPlaybackProvider implements MediaPlaybackProvider {
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: CloudflareStreamPlaybackConfig) {
    this.apiBase =
      config.apiBase ?? 'https://api.cloudflare.com/client/v4';
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error(
        'CloudflareStreamPlaybackProvider timeoutMs must be > 0',
      );
    }
    if (!config.customerCode.trim()) {
      throw new Error(
        'CloudflareStreamPlaybackProvider customerCode is required',
      );
    }
  }

  async createSignedPlayback(
    input: CreateSignedPlaybackInput,
  ): Promise<Result<SignedPlayback, DomainError>> {
    try {
      const exp = Math.floor(input.expiresAt.getTime() / 1000);
      const response = await this.fetchWithTimeout(
        `${this.apiBase}/accounts/${this.config.accountId}/stream/${input.providerRef}/token`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ exp }),
        },
      );

      if (!response.ok) {
        return fail(new MediaProviderUnavailableError());
      }

      const payload = (await response.json()) as CloudflareEnvelope<{
        token?: string;
      }>;

      if (!payload.success || !payload.result?.token) {
        return fail(new MediaProviderUnavailableError());
      }

      const token = payload.result.token;
      const playbackUrl = `https://customer-${this.config.customerCode.trim()}.cloudflarestream.com/${token}/iframe`;
      return ok({
        playbackUrl,
        expiresAt: input.expiresAt,
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

export class UnavailableMediaPlaybackProvider implements MediaPlaybackProvider {
  async createSignedPlayback(
    _input: CreateSignedPlaybackInput,
  ): Promise<Result<SignedPlayback, DomainError>> {
    return fail(new MediaProviderUnavailableError());
  }
}
