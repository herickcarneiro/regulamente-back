import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import { MediaAsset } from '../../core/entities/media-asset.entity';
import { MediaProviderUnavailableError } from '../../core/errors/media.errors';
import type { MediaAssetRepository } from '../../core/repositories/media-asset.repository';
import type {
  CreateSignedPlaybackInput,
  MediaPlaybackProvider,
  SignedPlayback,
} from '../../core/repositories/media-playback.provider';
import type {
  CreateDirectVideoUploadInput,
  DirectVideoUpload,
  MediaUploadProvider,
  ProviderVideoStatus,
} from '../../core/repositories/media-upload.provider';
import type { MediaStatus } from '../../core/value-objects/media-status';

export class InMemoryMediaAssetRepository implements MediaAssetRepository {
  private readonly items = new Map<string, MediaAsset>();

  seed(asset: MediaAsset): void {
    this.items.set(asset.id, asset);
  }

  async create(asset: MediaAsset): Promise<MediaAsset> {
    this.items.set(asset.id, asset);
    return asset;
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.items.get(id) ?? null;
  }

  async list(filters: {
    status?: MediaStatus;
    kind?: string;
    page: number;
    pageSize: number;
  }) {
    let items = [...this.items.values()];
    if (filters.status) {
      items = items.filter((item) => item.status === filters.status);
    }
    if (filters.kind) {
      items = items.filter((item) => item.kind === filters.kind);
    }
    items.sort((a, b) => {
      const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (byUpdated !== 0) return byUpdated;
      return a.id.localeCompare(b.id);
    });
    const total = items.length;
    const offset = (filters.page - 1) * filters.pageSize;
    return {
      items: items.slice(offset, offset + filters.pageSize),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async update(asset: MediaAsset): Promise<MediaAsset> {
    this.items.set(asset.id, asset);
    return asset;
  }
}

export class FakeMediaUploadProvider implements MediaUploadProvider {
  available = true;
  createCalls: CreateDirectVideoUploadInput[] = [];
  getStatusCalls: string[] = [];
  nextUpload: DirectVideoUpload = {
    uploadUrl: 'https://upload.example/one-time',
    providerRef: 'provider-ref-1',
  };
  statuses = new Map<string, ProviderVideoStatus>();

  async createDirectVideoUpload(
    input: CreateDirectVideoUploadInput,
  ): Promise<Result<DirectVideoUpload, DomainError>> {
    this.createCalls.push(input);
    if (!this.available) {
      return fail(new MediaProviderUnavailableError());
    }
    return ok({ ...this.nextUpload });
  }

  async getVideoStatus(
    providerRef: string,
  ): Promise<Result<ProviderVideoStatus, DomainError>> {
    this.getStatusCalls.push(providerRef);
    if (!this.available) {
      return fail(new MediaProviderUnavailableError());
    }
    return ok(
      this.statuses.get(providerRef) ?? {
        status: 'pending_upload',
        durationSeconds: null,
      },
    );
  }
}

export class FakeMediaPlaybackProvider implements MediaPlaybackProvider {
  available = true;
  createCalls: CreateSignedPlaybackInput[] = [];
  next: SignedPlayback = {
    playbackUrl: 'https://customer-test.cloudflarestream.com/signed-token/iframe',
    expiresAt: new Date('2026-07-27T15:15:00.000Z'),
  };

  async createSignedPlayback(
    input: CreateSignedPlaybackInput,
  ): Promise<Result<SignedPlayback, DomainError>> {
    this.createCalls.push(input);
    if (!this.available) {
      return fail(new MediaProviderUnavailableError());
    }
    return ok({
      playbackUrl: this.next.playbackUrl,
      expiresAt: input.expiresAt,
    });
  }
}
