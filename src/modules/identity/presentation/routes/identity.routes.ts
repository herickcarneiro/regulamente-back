import { Elysia } from 'elysia';
import type { IdentityService } from '../../application/services/identity.service';
import { respondDomainError } from '../errors/map-identity-error';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  readSessionCookie,
} from '../plugins/session-cookie';
import { loginRequestSchema } from '../schemas/identity.schema';

export type IdentityRoutesDeps = {
  identityService: IdentityService;
  sessionTtlSeconds: number;
  secureCookies: boolean;
};

export function createIdentityRoutes(deps: IdentityRoutesDeps) {
  return new Elysia({ name: 'identity' })
    .group('/api/v1/auth', (auth) =>
      auth
        .post(
          '/login',
          async ({ body, set }) => {
            const result = await deps.identityService.login(body);
            if (!result.ok) {
              return respondDomainError(set, result.error);
            }

            set.headers['set-cookie'] = buildSessionCookie(
              result.value.rawToken,
              {
                secure: deps.secureCookies,
                maxAgeSeconds: deps.sessionTtlSeconds,
              },
            );
            return result.value.session;
          },
          {
            body: loginRequestSchema,
          },
        )
        .post('/logout', async ({ request, set }) => {
          const token = readSessionCookie(request.headers.get('cookie'));
          await deps.identityService.logout(token);
          set.headers['set-cookie'] = buildClearSessionCookie(
            deps.secureCookies,
          );
          set.status = 204;
          return;
        })
        .get('/session', async ({ request, set }) => {
          const token = readSessionCookie(request.headers.get('cookie'));
          const result = await deps.identityService.getSession(token);
          if (!result.ok) {
            return respondDomainError(set, result.error);
          }
          return result.value;
        }),
    )
    .group('/api/v1/identity', (identity) =>
      identity.get('/users', async ({ request, set }) => {
        const token = readSessionCookie(request.headers.get('cookie'));
        const result = await deps.identityService.listUsers(token);
        if (!result.ok) {
          return respondDomainError(set, result.error);
        }
        return result.value;
      }),
    );
}
