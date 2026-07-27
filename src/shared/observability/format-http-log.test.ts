import { describe, expect, it } from 'bun:test';
import {
  formatHttpLogLine,
  httpStatusColor,
  shouldSkipHttpLog,
} from './format-http-log';

describe('formatHttpLogLine', () => {
  it('formats METHOD pathname STATUS DURATIONms without query or secrets', () => {
    const line = formatHttpLogLine({
      method: 'POST',
      pathname: '/api/v1/contents',
      status: 201,
      durationMs: 12,
      color: false,
    });

    expect(line).toBe('HTTP POST /api/v1/contents 201 12ms');
    expect(line).not.toContain('?');
    expect(line).not.toContain('Authorization');
  });

  it('applies ANSI colors by status class when color is enabled', () => {
    expect(httpStatusColor(201)).toBe('green');
    expect(httpStatusColor(301)).toBe('cyan');
    expect(httpStatusColor(404)).toBe('yellow');
    expect(httpStatusColor(500)).toBe('red');

    const colored = formatHttpLogLine({
      method: 'GET',
      pathname: '/api/v1/contents',
      status: 500,
      durationMs: 3,
      color: true,
    });

    expect(colored).toContain('\u001b[');
    expect(colored).toContain('HTTP GET /api/v1/contents 500 3ms');
  });
});

describe('shouldSkipHttpLog', () => {
  it('skips OPTIONS and /health by default', () => {
    expect(shouldSkipHttpLog('OPTIONS', '/api/v1/contents')).toBe(true);
    expect(shouldSkipHttpLog('GET', '/health')).toBe(true);
    expect(shouldSkipHttpLog('GET', '/api/v1/contents')).toBe(false);
  });
});
