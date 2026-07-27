import { Elysia } from 'elysia';
import type { IdentityService } from '../../../identity/application/services/identity.service';
import { readSessionCookie } from '../../../identity/presentation/plugins/session-cookie';
import type { ContentService } from '../../application/services/content.service';
import type { EmotionCategory } from '../../core/value-objects/emotion-category';
import { respondContentError } from '../errors/map-content-error';
import {
  contentIdParamSchema,
  contentListQuerySchema,
  createContentDraftSchema,
  updateContentDraftSchema,
} from '../schemas/content.schema';

export type ContentRoutesDeps = {
  contentService: ContentService;
  identityService: IdentityService;
};

async function requireConteudosActor(
  identityService: IdentityService,
  request: Request,
) {
  const token = readSessionCookie(request.headers.get('cookie'));
  const session = await identityService.getAuthorizedSession(
    token,
    'conteudos',
  );
  if (!session.ok) {
    return session;
  }
  return {
    ok: true as const,
    value: {
      userId: session.value.id,
      name: session.value.name,
      role: session.value.role,
    },
  };
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

export function createContentRoutes(deps: ContentRoutesDeps) {
  return new Elysia({ name: 'content' }).group('/api/v1/contents', (app) =>
    app
      .get('/', async ({ request, query, set }) => {
        const auth = await requireConteudosActor(deps.identityService, request);
        if (!auth.ok) {
          return respondContentError(set, auth.error);
        }

        const parsed = contentListQuerySchema.safeParse(query);
        if (!parsed.success) {
          return validationError(set, parsed.error.issues);
        }

        const category =
          parsed.data.category === undefined
            ? undefined
            : parsed.data.category === 'none'
              ? null
              : (parsed.data.category as EmotionCategory);

        const result = await deps.contentService.list({
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          q: parsed.data.q,
          status: parsed.data.status,
          type: parsed.data.type,
          category,
        });
        if (!result.ok) {
          return respondContentError(set, result.error);
        }
        return result.value;
      })
      .get('/:id', async ({ request, params, set }) => {
        const auth = await requireConteudosActor(deps.identityService, request);
        if (!auth.ok) {
          return respondContentError(set, auth.error);
        }

        const parsedParams = contentIdParamSchema.safeParse(params);
        if (!parsedParams.success) {
          return validationError(set, parsedParams.error.issues);
        }

        const result = await deps.contentService.getById(parsedParams.data.id);
        if (!result.ok) {
          return respondContentError(set, result.error);
        }
        return result.value;
      })
      .post('/', async ({ request, set }) => {
        const auth = await requireConteudosActor(deps.identityService, request);
        if (!auth.ok) {
          return respondContentError(set, auth.error);
        }

        const parsed = createContentDraftSchema.safeParse(
          await readJsonBody(request),
        );
        if (!parsed.success) {
          return validationError(set, parsed.error.issues);
        }

        const result = await deps.contentService.createDraft(
          auth.value,
          parsed.data,
        );
        if (!result.ok) {
          return respondContentError(set, result.error);
        }

        set.status = 201;
        set.headers['location'] = `/api/v1/contents/${result.value.id}`;
        return result.value;
      })
      .patch('/:id', async ({ request, params, set }) => {
        const auth = await requireConteudosActor(deps.identityService, request);
        if (!auth.ok) {
          return respondContentError(set, auth.error);
        }

        const parsedParams = contentIdParamSchema.safeParse(params);
        if (!parsedParams.success) {
          return validationError(set, parsedParams.error.issues);
        }

        const parsedBody = updateContentDraftSchema.safeParse(
          await readJsonBody(request),
        );
        if (!parsedBody.success) {
          return validationError(set, parsedBody.error.issues);
        }

        const result = await deps.contentService.updateDraft(
          auth.value,
          parsedParams.data.id,
          parsedBody.data,
        );
        if (!result.ok) {
          return respondContentError(set, result.error);
        }
        return result.value;
      }),
  );
}
