import { DomainError } from './domain.error';

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(resource = 'Resource') {
    super(`${resource} not found`);
  }
}
