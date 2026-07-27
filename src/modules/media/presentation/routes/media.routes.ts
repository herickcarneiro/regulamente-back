import { Elysia } from 'elysia';
import type { IdentityService } from '../../../identity/application/services/identity.service';
import { readSessionCookie } from '../../../identity/presentation/plugins/session-cookie';
import type { MediaService } from '../../application/services/media.service';
import { respondMediaError } from '../errors/map-media-error';
import {
  createVideoUploadRequestSchema,
  mediaAssetIdParamSchema,
  mediaAssetListQuerySchema,
} from '../schemas/media.schema';

export type MediaRoutesDeps = {
  mediaService: MediaService;
  identityService: IdentityService;
};

async function requireConteudos(
  identityService: IdentityService,
  request: Request,
) {
  const token = readSessionCookie(request.headers.get('cookie'));
  return identityService.getAuthorizedSession(token, 'conteudos');
}

function validationError(
  set: { status?: number | string },
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  set.status = 400;
  return {
    error: 'validation' as const,
    message: 'Invalid request',
    details: issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createMediaRoutes(deps: MediaRoutesDeps) {
  return new Elysia({ name: 'media' }).group('/api/v1/media-assets', (app) =>
    app
      .get('/', async ({ request, query, set }) => {
        const auth = await requireConteudos(deps.identityService, request);
        if (!auth.ok) {
          return respondMediaError(set, auth.error);
        }

        const parsed = mediaAssetListQuerySchema.safeParse(query);
        if (!parsed.success) {
          return validationError(set, parsed.error.issues);
        }

        const result = await deps.mediaService.list({
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          status: parsed.data.status,
          kind: parsed.data.kind,
        });
        if (!result.ok) {
          return respondMediaError(set, result.error);
        }
        return result.value;
      })
      .post('/video-upload-requests', async ({ request, set }) => {
        const auth = await requireConteudos(deps.identityService, request);
        if (!auth.ok) {
          return respondMediaError(set, auth.error);
        }

        const parsed = createVideoUploadRequestSchema.safeParse(
          await readJsonBody(request),
        );
        if (!parsed.success) {
          return validationError(set, parsed.error.issues);
        }

        const result = await deps.mediaService.createVideoUploadRequest(
          {
            userId: auth.value.id,
            name: auth.value.name,
            role: auth.value.role,
          },
          parsed.data,
        );
        if (!result.ok) {
          return respondMediaError(set, result.error);
        }

        set.status = 201;
        set.headers['location'] = `/api/v1/media-assets/${result.value.id}`;
        return result.value;
      })
      .get('/:id', async ({ request, params, set }) => {
        const auth = await requireConteudos(deps.identityService, request);
        if (!auth.ok) {
          return respondMediaError(set, auth.error);
        }

        const parsedParams = mediaAssetIdParamSchema.safeParse(params);
        if (!parsedParams.success) {
          return validationError(set, parsedParams.error.issues);
        }

        const result = await deps.mediaService.getById(parsedParams.data.id);
        if (!result.ok) {
          return respondMediaError(set, result.error);
        }
        return result.value;
      })
      .post('/:id/playback-sessions', async ({ request, params, set }) => {
        const auth = await requireConteudos(deps.identityService, request);
        if (!auth.ok) {
          return respondMediaError(set, auth.error);
        }

        const parsedParams = mediaAssetIdParamSchema.safeParse(params);
        if (!parsedParams.success) {
          return validationError(set, parsedParams.error.issues);
        }

        const result = await deps.mediaService.createPlaybackSession(
          parsedParams.data.id,
        );
        if (!result.ok) {
          return respondMediaError(set, result.error);
        }

        // Response explícito: mutação em set.headers pode não chegar ao
        // Response de app.handle em alguns caminhos do pipeline Elysia.
        return Response.json(result.value, {
          status: 201,
          headers: {
            'Cache-Control': 'no-store',
          },
        });
      }),
  );
}
