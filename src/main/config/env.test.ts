import { describe, expect, it } from 'bun:test';
import { loadEnv, parseCorsOrigins } from './env';

describe('loadEnv', () => {
  it('applies defaults when optional values are omitted', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://regulamente:regulamente@127.0.0.1:54329/regulamente',
    });

    expect(env.PORT).toBe(3000);
    expect(env.SESSION_TTL_SECONDS).toBe(28800);
    expect(env.MEDIA_MAX_DURATION_SECONDS).toBe(900);
    expect(env.MEDIA_UPLOAD_URL_TTL_SECONDS).toBe(900);
    expect(env.MEDIA_PLAYBACK_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.CLOUDFLARE_STREAM_TIMEOUT_MS).toBe(10_000);
    expect(env.CORS_ORIGINS).toContain('localhost:5176');
    expect(env.HTTP_LOG_ENABLED).toBe(false);
  });

  it('enables HTTP log by default in development', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://regulamente:regulamente@127.0.0.1:54329/regulamente',
      HTTP_LOG_COLOR: 'false',
    });
    expect(env.HTTP_LOG_ENABLED).toBe(true);
    expect(env.HTTP_LOG_COLOR).toBe(false);
  });

  it('parses PORT and CORS origins at the boundary', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      PORT: '4000',
      DATABASE_URL: 'postgres://regulamente:regulamente@127.0.0.1:54329/regulamente',
      CORS_ORIGINS: 'http://localhost:5173, http://localhost:5176',
    });

    expect(env.PORT).toBe(4000);
    expect(parseCorsOrigins(env.CORS_ORIGINS)).toEqual([
      'http://localhost:5173',
      'http://localhost:5176',
    ]);
  });
});
