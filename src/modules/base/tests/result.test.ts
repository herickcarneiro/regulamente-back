import { describe, expect, it } from 'bun:test';
import { fail, isFailure, isSuccess, ok } from '../core/result/result';

describe('Result', () => {
  it('wraps a successful value', () => {
    const result = ok(42);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('wraps a failure', () => {
    const result = fail('broken');

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error).toBe('broken');
    }
  });
});
