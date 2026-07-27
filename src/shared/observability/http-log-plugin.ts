import { Elysia } from 'elysia';
import {
  formatHttpLogLine,
  shouldSkipHttpLog,
} from './format-http-log';

export type HttpLogPluginConfig = {
  enabled: boolean;
  color: boolean;
  write?: (line: string) => void;
  /** Monotonic clock in ms (defaults to performance.now). */
  now?: () => number;
};

export function pathnameOf(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    const raw = request.url.split('?')[0] || '/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

export function resolveHttpStatus(
  status: number | string | undefined,
): number {
  if (typeof status === 'number' && Number.isFinite(status)) {
    return status;
  }
  if (typeof status === 'string' && status !== '') {
    const parsed = Number(status);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 200;
}

/**
 * HTTP request logger — single onAfterResponse hook with final status.
 * Must be registered before routes so the interceptor is inherited.
 * Start time lives in a WeakMap (never mutates Request).
 *
 * Important (Elysia 1.4.x): onRequest must not return WeakMap.set()/Array.push()
 * — use a block body that returns undefined, otherwise the request short-circuits as 200.
 */
export function createHttpLogPlugin(config: HttpLogPluginConfig) {
  const write = config.write ?? ((line: string) => console.log(line));
  const now = config.now ?? (() => performance.now());
  const startedAtByRequest = new WeakMap<Request, number>();

  return new Elysia({ name: 'http-log' })
    .onRequest(({ request }) => {
      if (!config.enabled) {
        return;
      }
      const pathname = pathnameOf(request);
      if (shouldSkipHttpLog(request.method, pathname)) {
        return;
      }
      // void: WeakMap.set returns the map; returning it would become a 200 response.
      void startedAtByRequest.set(request, now());
    })
    .onAfterResponse({ as: 'global' }, (context) => {
      if (!config.enabled) {
        return;
      }

      const { request, set } = context;
      const pathname = pathnameOf(request);
      if (shouldSkipHttpLog(request.method, pathname)) {
        return;
      }

      const startedAt = startedAtByRequest.get(request);
      startedAtByRequest.delete(request);
      const durationMs =
        startedAt === undefined
          ? 0
          : Math.max(0, Math.round(now() - startedAt));

      write(
        formatHttpLogLine({
          method: request.method,
          pathname,
          status: resolveHttpStatus(set.status),
          durationMs,
          color: config.color,
        }),
      );
    });
}
