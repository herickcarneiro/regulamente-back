import { describe, expect, it } from 'bun:test';
import { createTestApp } from '../../../shared/testing/create-test-app';

describe('GET /health', () => {
  it('does not bind a listener when the app is created', () => {
    const { app } = createTestApp();
    expect(app.server).toBeNull();
  });

  it('returns a stable health payload', async () => {
    const { app } = createTestApp();
    const response = await app.handle(new Request('http://localhost/health'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'regulamente-back',
    });
  });
});
