import { describe, expect, it } from 'bun:test';
import { parseCloudflareStreamAllowedOrigins } from './parse-cloudflare-stream-allowed-origins';

describe('parseCloudflareStreamAllowedOrigins', () => {
  it('parses hostname CSV with optional ports', () => {
    expect(
      parseCloudflareStreamAllowedOrigins(
        'localhost:5176, app.example.com, localhost:5173',
      ),
    ).toEqual(['localhost:5176', 'app.example.com', 'localhost:5173']);
  });

  it('returns undefined for empty input', () => {
    expect(parseCloudflareStreamAllowedOrigins(undefined)).toBeUndefined();
    expect(parseCloudflareStreamAllowedOrigins('  ')).toBeUndefined();
  });

  it('rejects scheme URLs', () => {
    expect(() =>
      parseCloudflareStreamAllowedOrigins('http://localhost:5176'),
    ).toThrow(/no scheme/);
    expect(() =>
      parseCloudflareStreamAllowedOrigins('https://app.example.com'),
    ).toThrow(/no scheme/);
  });

  it('rejects path or query', () => {
    expect(() =>
      parseCloudflareStreamAllowedOrigins('app.example.com/path'),
    ).toThrow(/path/);
    expect(() =>
      parseCloudflareStreamAllowedOrigins('app.example.com?x=1'),
    ).toThrow(/path/);
  });
});
