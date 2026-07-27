import { DomainError } from '../../../base/core/errors/domain.error';

export class ContentNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Content not found') {
    super(message);
  }
}

/** Wire: conflict — status !== draft */
export class ContentNotEditableError extends DomainError {
  readonly code = 'CONTENT_NOT_EDITABLE';
  constructor(message = 'Content is not editable') {
    super(message);
  }
}

/** Wire: conflict — expectedVersion mismatch */
export class VersionConflictError extends DomainError {
  readonly code = 'VERSION_CONFLICT';
  constructor(message = 'Content version conflict') {
    super(message);
  }
}

export class ContentValidationError extends DomainError {
  readonly code = 'INVALID_INPUT';
  constructor(message = 'Invalid content input') {
    super(message);
  }
}

/** Wire: not_found — linked mediaAssetId does not exist */
export class LinkedMediaNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Linked media asset not found') {
    super(message);
  }
}

/** Wire: conflict — linked media is not video/ready */
export class LinkedMediaNotReadyError extends DomainError {
  readonly code = 'CONFLICT';
  constructor(message = 'Linked media asset is not ready for association') {
    super(message);
  }
}
