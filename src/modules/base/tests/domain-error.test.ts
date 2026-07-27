import { describe, expect, it } from 'bun:test';
import { InvalidInputError } from '../core/errors/invalid-input.error';
import { NotFoundError } from '../core/errors/not-found.error';

describe('DomainError hierarchy', () => {
  it('exposes stable NOT_FOUND code', () => {
    const error = new NotFoundError('PilotItem');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('PilotItem');
  });

  it('exposes stable INVALID_INPUT code', () => {
    const error = new InvalidInputError('name required');
    expect(error.code).toBe('INVALID_INPUT');
  });
});
