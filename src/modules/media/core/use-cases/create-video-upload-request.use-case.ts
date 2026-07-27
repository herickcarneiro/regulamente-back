import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import { MediaAsset } from '../entities/media-asset.entity';
import type { MediaAssetRepository } from '../repositories/media-asset.repository';
import type { MediaUploadProvider } from '../repositories/media-upload.provider';

export type CreateVideoUploadRequestInput = {
  title: string;
  originalFileName: string;
  createdByUserId: string;
};

export type CreateVideoUploadRequestResult = {
  asset: MediaAsset;
  uploadUrl: string;
};

export type PreparedVideoUpload = {
  title: string;
  originalFileName: string;
  providerRef: string;
  uploadUrl: string;
  uploadExpiresAt: Date;
  now: Date;
};

export type CreateVideoUploadRequestDeps = {
  assets: MediaAssetRepository;
  uploadProvider: MediaUploadProvider;
  maxDurationSeconds: number;
  uploadUrlTtlSeconds: number;
  now?: () => Date;
  newId?: () => string;
};

export class CreateVideoUploadRequestUseCase {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: CreateVideoUploadRequestDeps) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  /** Provider call — keep outside Postgres transactions. */
  async prepare(
    input: CreateVideoUploadRequestInput,
  ): Promise<Result<PreparedVideoUpload, DomainError>> {
    const metadata = MediaAsset.normalizeVideoUploadMetadata(input);
    if (!metadata.ok) {
      return fail(metadata.error);
    }

    const now = this.now();
    const uploadExpiresAt = new Date(
      now.getTime() + this.deps.uploadUrlTtlSeconds * 1000,
    );

    const upload = await this.deps.uploadProvider.createDirectVideoUpload({
      title: metadata.value.title,
      originalFileName: metadata.value.originalFileName,
      maxDurationSeconds: this.deps.maxDurationSeconds,
      uploadUrlExpiresAt: uploadExpiresAt,
    });
    if (!upload.ok) {
      return upload;
    }

    return ok({
      title: metadata.value.title,
      originalFileName: metadata.value.originalFileName,
      providerRef: upload.value.providerRef,
      uploadUrl: upload.value.uploadUrl,
      uploadExpiresAt,
      now,
    });
  }

  /** Persist asset row — intended to run inside the same TX as audit. */
  async persist(
    prepared: PreparedVideoUpload,
    options: { createdByUserId: string; tx?: TransactionContext },
  ): Promise<Result<CreateVideoUploadRequestResult, DomainError>> {
    const created = MediaAsset.createVideoUpload({
      id: this.newId(),
      title: prepared.title,
      originalFileName: prepared.originalFileName,
      providerRef: prepared.providerRef,
      uploadExpiresAt: prepared.uploadExpiresAt,
      createdByUserId: options.createdByUserId,
      now: prepared.now,
    });
    if (!created.ok) {
      return fail(created.error);
    }

    const saved = await this.deps.assets.create(created.value, options.tx);
    return ok({ asset: saved, uploadUrl: prepared.uploadUrl });
  }

  async execute(
    input: CreateVideoUploadRequestInput,
  ): Promise<Result<CreateVideoUploadRequestResult, DomainError>> {
    const prepared = await this.prepare(input);
    if (!prepared.ok) {
      return prepared;
    }
    return this.persist(prepared.value, {
      createdByUserId: input.createdByUserId,
    });
  }
}
