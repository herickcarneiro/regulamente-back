import { describe, expect, it } from 'bun:test';
import { shouldUseSecureCookies } from './cookie-security';

describe('shouldUseSecureCookies', () => {
  it('is false for development and test (local HTTP Compose)', () => {
    expect(shouldUseSecureCookies({ NODE_ENV: 'development' })).toBe(false);
    expect(shouldUseSecureCookies({ NODE_ENV: 'test' })).toBe(false);
  });

  it('is true only for production', () => {
    expect(shouldUseSecureCookies({ NODE_ENV: 'production' })).toBe(true);
  });
});
