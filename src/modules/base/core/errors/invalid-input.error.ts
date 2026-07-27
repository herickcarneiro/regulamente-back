import { DomainError } from './domain.error';

export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT';

  constructor(message = 'Invalid input') {
    super(message);
  }
}
