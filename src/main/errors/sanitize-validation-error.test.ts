import { describe, expect, it } from 'bun:test';
import { sanitizeValidationError } from './sanitize-validation-error';

describe('sanitizeValidationError', () => {
  it('never echoes password or full request body values', () => {
    const payload = sanitizeValidationError({
      message: JSON.stringify({
        found: {
          email: 'not-an-email',
          password: 'secret-password-leak',
        },
      }),
      all: [
        {
          path: 'email',
          message: 'Invalid email address',
          value: {
            email: 'not-an-email',
            password: 'secret-password-leak',
          },
        },
      ],
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('secret-password-leak');
    expect(serialized).not.toContain('not-an-email');
    expect(payload).toEqual({
      error: 'validation',
      message: 'Invalid request',
      details: [{ path: 'email', message: 'Invalid email address' }],
    });
  });
});
