import { describe, expect, it } from 'bun:test';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from './session-cookie';

describe('session cookie attributes', () => {
  it('omits Secure for local HTTP (development/test)', () => {
    const cookie = buildSessionCookie('opaque-token', {
      secure: false,
      maxAgeSeconds: 28800,
    });

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=opaque-token`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).not.toContain('Secure');
  });

  it('includes Secure in production HTTPS mode', () => {
    const cookie = buildSessionCookie('opaque-token', {
      secure: true,
      maxAgeSeconds: 28800,
    });

    expect(cookie).toContain('Secure');
    expect(buildClearSessionCookie(true)).toContain('Secure');
    expect(buildClearSessionCookie(false)).not.toContain('Secure');
  });
});
