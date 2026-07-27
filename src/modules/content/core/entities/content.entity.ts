import { fail, ok, type Result } from '../../../base/core/result/result';
import {
  ContentNotEditableError,
  ContentValidationError,
  VersionConflictError,
} from '../errors/content.errors';
import type { ContentStatus } from '../value-objects/content-status';
import type { ContentType } from '../value-objects/content-type';
import type { EmotionCategory } from '../value-objects/emotion-category';

export type ContentProps = {
  id: string;
  title: string;
  type: ContentType;
  category: EmotionCategory | null;
  status: ContentStatus;
  description: string;
  body: string;
  authorUserId: string;
  authorName: string;
  /** Opaque Media id — no FK; null when unlinked. */
  mediaAssetId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDraftInput = {
  id: string;
  title: string;
  type: ContentType;
  category: EmotionCategory | null;
  description: string;
  body: string;
  authorUserId: string;
  authorName: string;
  mediaAssetId?: string | null;
  now: Date;
};

export type DraftUpdatePatch = {
  expectedVersion: number;
  title?: string;
  description?: string;
  body?: string;
  type?: ContentType;
  category?: EmotionCategory | null;
  /** Omit preserves; null unlinks. */
  mediaAssetId?: string | null;
};

function typeAcceptsMedia(type: ContentType): boolean {
  return type === 'video' || type === 'mixed';
}

function assertMediaCompatibility(
  type: ContentType,
  mediaAssetId: string | null,
): ContentValidationError | null {
  if (mediaAssetId !== null && !typeAcceptsMedia(type)) {
    return new ContentValidationError(
      'mediaAssetId requires content type video or mixed',
    );
  }
  return null;
}

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const BODY_MAX = 100_000;

export class Content {
  readonly id: string;
  readonly title: string;
  readonly type: ContentType;
  readonly category: EmotionCategory | null;
  readonly status: ContentStatus;
  readonly description: string;
  readonly body: string;
  readonly authorUserId: string;
  readonly authorName: string;
  readonly mediaAssetId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ContentProps) {
    this.id = props.id;
    this.title = props.title;
    this.type = props.type;
    this.category = props.category;
    this.status = props.status;
    this.description = props.description;
    this.body = props.body;
    this.authorUserId = props.authorUserId;
    this.authorName = props.authorName;
    this.mediaAssetId = props.mediaAssetId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static restore(props: ContentProps): Content {
    return new Content(props);
  }

  static createDraft(
    input: CreateDraftInput,
  ): Result<Content, ContentValidationError> {
    const title = input.title.trim();
    if (title.length < 1 || title.length > TITLE_MAX) {
      return fail(new ContentValidationError('Invalid title'));
    }
    if (input.description.length > DESCRIPTION_MAX) {
      return fail(new ContentValidationError('Invalid description'));
    }
    if (input.body.length > BODY_MAX) {
      return fail(new ContentValidationError('Invalid body'));
    }
    if (!input.authorUserId || !input.authorName.trim()) {
      return fail(new ContentValidationError('Invalid author snapshot'));
    }

    const mediaAssetId = input.mediaAssetId ?? null;
    const mediaError = assertMediaCompatibility(input.type, mediaAssetId);
    if (mediaError) {
      return fail(mediaError);
    }

    return ok(
      new Content({
        id: input.id,
        title,
        type: input.type,
        category: input.category,
        status: 'draft',
        description: input.description,
        body: input.body,
        authorUserId: input.authorUserId,
        authorName: input.authorName,
        mediaAssetId,
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      }),
    );
  }

  applyDraftUpdate(
    patch: DraftUpdatePatch,
    now: Date,
  ): Result<
    Content,
    ContentValidationError | VersionConflictError | ContentNotEditableError
  > {
    if (this.status !== 'draft') {
      return fail(new ContentNotEditableError());
    }
    if (patch.expectedVersion !== this.version) {
      return fail(new VersionConflictError());
    }

    const title =
      patch.title !== undefined ? patch.title.trim() : this.title;
    if (title.length < 1 || title.length > TITLE_MAX) {
      return fail(new ContentValidationError('Invalid title'));
    }

    const description =
      patch.description !== undefined ? patch.description : this.description;
    if (description.length > DESCRIPTION_MAX) {
      return fail(new ContentValidationError('Invalid description'));
    }

    const body = patch.body !== undefined ? patch.body : this.body;
    if (body.length > BODY_MAX) {
      return fail(new ContentValidationError('Invalid body'));
    }

    const type = patch.type ?? this.type;
    const mediaAssetId =
      patch.mediaAssetId !== undefined ? patch.mediaAssetId : this.mediaAssetId;
    const mediaError = assertMediaCompatibility(type, mediaAssetId);
    if (mediaError) {
      return fail(mediaError);
    }

    return ok(
      new Content({
        id: this.id,
        title,
        type,
        category:
          patch.category !== undefined ? patch.category : this.category,
        status: this.status,
        description,
        body,
        authorUserId: this.authorUserId,
        authorName: this.authorName,
        mediaAssetId,
        version: this.version + 1,
        createdAt: this.createdAt,
        updatedAt: now,
      }),
    );
  }
}
