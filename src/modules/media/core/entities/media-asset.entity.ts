import { fail, ok, type Result } from '../../../base/core/result/result';
import { MediaValidationError } from '../errors/media.errors';
import type { MediaKind } from '../value-objects/media-kind';
import {
  shouldApplyProviderStatus,
  type MediaStatus,
} from '../value-objects/media-status';

export type MediaAssetProps = {
  id: string;
  title: string;
  originalFileName: string;
  kind: MediaKind;
  status: MediaStatus;
  durationSeconds: number | null;
  providerRef: string;
  /** Internal only — never exposed on the wire. */
  uploadExpiresAt: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VideoUploadMetadata = {
  title: string;
  originalFileName: string;
};

export type CreateVideoUploadInput = {
  id: string;
  title: string;
  originalFileName: string;
  providerRef: string;
  uploadExpiresAt: Date;
  createdByUserId: string;
  now: Date;
};

export type ProviderStatusSnapshot = {
  status: MediaStatus;
  durationSeconds: number | null;
};

const TITLE_MAX = 200;
const FILE_NAME_MAX = 255;

export class MediaAsset {
  readonly id: string;
  readonly title: string;
  readonly originalFileName: string;
  readonly kind: MediaKind;
  readonly status: MediaStatus;
  readonly durationSeconds: number | null;
  readonly providerRef: string;
  readonly uploadExpiresAt: Date;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: MediaAssetProps) {
    this.id = props.id;
    this.title = props.title;
    this.originalFileName = props.originalFileName;
    this.kind = props.kind;
    this.status = props.status;
    this.durationSeconds = props.durationSeconds;
    this.providerRef = props.providerRef;
    this.uploadExpiresAt = props.uploadExpiresAt;
    this.createdByUserId = props.createdByUserId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static restore(props: MediaAssetProps): MediaAsset {
    return new MediaAsset(props);
  }

  static normalizeVideoUploadMetadata(input: {
    title: string;
    originalFileName: string;
    createdByUserId: string;
  }): Result<VideoUploadMetadata, MediaValidationError> {
    const title = input.title.trim();
    if (title.length < 1 || title.length > TITLE_MAX) {
      return fail(new MediaValidationError('Invalid title'));
    }

    const originalFileName = input.originalFileName.trim();
    if (
      originalFileName.length < 1 ||
      originalFileName.length > FILE_NAME_MAX
    ) {
      return fail(new MediaValidationError('Invalid originalFileName'));
    }

    if (!input.createdByUserId) {
      return fail(new MediaValidationError('Invalid createdByUserId'));
    }

    return ok({ title, originalFileName });
  }

  static createVideoUpload(
    input: CreateVideoUploadInput,
  ): Result<MediaAsset, MediaValidationError> {
    const metadata = MediaAsset.normalizeVideoUploadMetadata(input);
    if (!metadata.ok) {
      return metadata;
    }

    if (!input.providerRef.trim()) {
      return fail(new MediaValidationError('Invalid providerRef'));
    }

    if (
      !(input.uploadExpiresAt instanceof Date) ||
      Number.isNaN(input.uploadExpiresAt.getTime()) ||
      input.uploadExpiresAt.getTime() <= input.now.getTime()
    ) {
      return fail(new MediaValidationError('Invalid uploadExpiresAt'));
    }

    return ok(
      new MediaAsset({
        id: input.id,
        title: metadata.value.title,
        originalFileName: metadata.value.originalFileName,
        kind: 'video',
        status: 'pending_upload',
        durationSeconds: null,
        providerRef: input.providerRef.trim(),
        uploadExpiresAt: input.uploadExpiresAt,
        createdByUserId: input.createdByUserId,
        createdAt: input.now,
        updatedAt: input.now,
      }),
    );
  }

  reconcileFromProvider(
    snapshot: ProviderStatusSnapshot,
    now: Date,
  ): Result<MediaAsset, MediaValidationError> {
    if (!shouldApplyProviderStatus(this.status, snapshot.status)) {
      return ok(this);
    }

    if (
      snapshot.durationSeconds !== null &&
      (!Number.isFinite(snapshot.durationSeconds) ||
        snapshot.durationSeconds < 0)
    ) {
      return fail(new MediaValidationError('Invalid durationSeconds'));
    }

    return ok(
      new MediaAsset({
        id: this.id,
        title: this.title,
        originalFileName: this.originalFileName,
        kind: this.kind,
        status: snapshot.status,
        durationSeconds:
          snapshot.durationSeconds !== null
            ? snapshot.durationSeconds
            : this.durationSeconds,
        providerRef: this.providerRef,
        uploadExpiresAt: this.uploadExpiresAt,
        createdByUserId: this.createdByUserId,
        createdAt: this.createdAt,
        updatedAt: now,
      }),
    );
  }

  /**
   * Abandoned direct-upload policy: pending_upload past uploadExpiresAt → failed.
   * Returns null when no transition applies.
   */
  markAbandonedIfExpired(now: Date): MediaAsset | null {
    if (this.status !== 'pending_upload') {
      return null;
    }
    if (now.getTime() < this.uploadExpiresAt.getTime()) {
      return null;
    }
    return new MediaAsset({
      id: this.id,
      title: this.title,
      originalFileName: this.originalFileName,
      kind: this.kind,
      status: 'failed',
      durationSeconds: this.durationSeconds,
      providerRef: this.providerRef,
      uploadExpiresAt: this.uploadExpiresAt,
      createdByUserId: this.createdByUserId,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }

  needsProviderReconciliation(): boolean {
    return this.status === 'pending_upload' || this.status === 'processing';
  }
}
