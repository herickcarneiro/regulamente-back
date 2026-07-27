import { describe, expect, it } from 'bun:test';
import { createTestApp } from '../../../shared/testing/create-test-app';

describe('Identity security envelope', () => {
  it('does not leak password in validation errors', async () => {
    const { app } = createTestApp();
    const password = `leak-${crypto.randomUUID()}`;

    const response = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password,
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain(password);
    expect(JSON.parse(body)).toMatchObject({
      error: 'validation',
      message: 'Invalid request',
    });
  });

  it('exposes CORS credentials headers for the portal origin', async () => {
    const { app } = createTestApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5176',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5176',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
  });
});
