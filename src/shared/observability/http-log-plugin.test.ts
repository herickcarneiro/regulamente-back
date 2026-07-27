import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { createHttpLogPlugin } from './http-log-plugin';

/**
 * app.handle() resolves before onAfterResponse; await the write fake (or a tick).
 */
function createWriteProbe() {
  const lines: string[] = [];
  let pending: ((line: string) => void) | undefined;

  return {
    lines,
    write(line: string) {
      lines.push(line);
      pending?.(line);
      pending = undefined;
    },
    nextLine(): Promise<string> {
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
  };
}

function createLoggedApp(
  write: (line: string) => void,
  now?: () => number,
) {
  return new Elysia()
    .use(
      createHttpLogPlugin({
        enabled: true,
        color: false,
        write,
        now,
      }),
    )
    .onError(({ error, set, code }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: 'not_found' };
      }
      if (code === 'VALIDATION') {
        set.status = 400;
        return { error: 'validation' };
      }
      if (error instanceof Error && error.message === 'unauthorized') {
        set.status = 401;
        return { error: 'unauthorized' };
      }
      set.status = 500;
      return { error: 'internal' };
    })
    .post(
      '/api/v1/contents',
      ({ set }) => {
        set.status = 201;
        return { id: '1' };
      },
      {
        body: z.strictObject({
          title: z.string().min(1),
        }),
      },
    )
    .get('/api/v1/secure', () => {
      throw new Error('unauthorized');
    })
    .get('/api/v1/boom', () => {
      throw new Error('boom');
    })
    .options('/api/v1/contents', () => '')
    .get('/health', () => ({ status: 'ok' }));
}

async function handleAndAwaitLog(
  app: { handle: (request: Request) => Response | Promise<Response> },
  request: Request,
  nextLine: () => Promise<string>,
) {
  const logged = nextLine();
  const response = await app.handle(request);
  const line = await logged;
  return { response, line };
}

describe('createHttpLogPlugin', () => {
  it('emits exactly one line with final status for 201/400/401/404/500', async () => {
    const probe = createWriteProbe();
    let clock = 0;
    const app = createLoggedApp(probe.write, () => {
      clock += 5;
      return clock;
    });

    const created = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'ok' }),
      }),
      probe.nextLine,
    );
    expect(created.response.status).toBe(201);
    expect(created.line).toBe('HTTP POST /api/v1/contents 201 5ms');

    const invalid = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      probe.nextLine,
    );
    expect(invalid.response.status).toBe(400);
    expect(invalid.line).toBe('HTTP POST /api/v1/contents 400 5ms');

    const unauthorized = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/secure'),
      probe.nextLine,
    );
    expect(unauthorized.response.status).toBe(401);
    expect(unauthorized.line).toBe('HTTP GET /api/v1/secure 401 5ms');

    const missing = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/missing'),
      probe.nextLine,
    );
    expect(missing.response.status).toBe(404);
    expect(missing.line).toBe('HTTP GET /api/v1/missing 404 5ms');

    const boom = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/boom'),
      probe.nextLine,
    );
    expect(boom.response.status).toBe(500);
    expect(boom.line).toBe('HTTP GET /api/v1/boom 500 5ms');

    expect(probe.lines).toHaveLength(5);
  });

  it('does not log query string, Authorization, OPTIONS or /health', async () => {
    const probe = createWriteProbe();
    const app = createLoggedApp(probe.write);

    const logged = await handleAndAwaitLog(
      app,
      new Request('http://localhost/api/v1/contents?token=secret', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer tok',
        },
        body: JSON.stringify({ title: 'ok' }),
      }),
      probe.nextLine,
    );
    expect(logged.line).toBe('HTTP POST /api/v1/contents 201 0ms');
    expect(logged.line).not.toContain('token');
    expect(logged.line).not.toContain('Bearer');

    await app.handle(
      new Request('http://localhost/api/v1/contents', { method: 'OPTIONS' }),
    );
    await app.handle(new Request('http://localhost/health'));
    await Promise.resolve();

    expect(probe.lines).toEqual(['HTTP POST /api/v1/contents 201 0ms']);
  });
});
