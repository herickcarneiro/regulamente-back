import { DomainError } from '../../../base/core/errors/domain.error';

export class MediaNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Media asset not found') {
    super(message);
  }
}

export class MediaValidationError extends DomainError {
  readonly code = 'INVALID_INPUT';
  constructor(message = 'Invalid media input') {
    super(message);
  }
}

export class MediaProviderUnavailableError extends DomainError {
  readonly code = 'MEDIA_PROVIDER_UNAVAILABLE';
  constructor(message = 'Media provider unavailable') {
    super(message);
  }
}

/** Wire: conflict — asset not ready or kind incompatible for playback */
export class MediaNotReadyForPlaybackError extends DomainError {
  readonly code = 'CONFLICT';
  constructor(message = 'Media asset is not ready for playback') {
    super(message);
  }
}
