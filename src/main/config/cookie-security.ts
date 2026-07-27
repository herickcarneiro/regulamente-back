import type { Env } from './env';

/** Secure cookies only when NODE_ENV=production (HTTPS). Local Compose/HTTP stays off. */
export function shouldUseSecureCookies(env: Pick<Env, 'NODE_ENV'>): boolean {
  return env.NODE_ENV === 'production';
}
