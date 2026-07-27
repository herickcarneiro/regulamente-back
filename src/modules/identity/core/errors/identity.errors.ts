import { DomainError } from '../../../base/core/errors/domain.error';

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Invalid email or password');
  }
}

export class InactiveUserError extends DomainError {
  readonly code = 'INACTIVE_USER';
  constructor() {
    super('User is inactive');
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  constructor(message = 'Forbidden') {
    super(message);
  }
}
