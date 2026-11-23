import type { OpenApiModule } from '../../../../shared/openapi/openapi';
import {
  authErrors,
  errorResponses,
  jsonRequestBody,
  jsonResponse,
  locationHeader,
  pathParameters,
  queryParameters,
  requiresSession,
} from '../../../../shared/openapi/openapi';
import {
  contentDetailSchema,
  contentIdParamSchema,
  contentListItemSchema,
  contentListQuerySchema,
  contentListResponseSchema,
  createContentDraftSchema,
  updateContentDraftSchema,
} from '../schemas/content.schema';

const TAG = 'Content';

const MEDIA_LINK_RULES =
  '`mediaAssetId` exige media `kind=video` + `status=ready` e conteúdo com `type` ∈ {`video`, `mixed`}.';

const errors = {
  ...authErrors('conteudos'),
  validation: 'Parâmetros ou corpo inválidos (campos desconhecidos são rejeitados).',
};

export const contentOpenApi: OpenApiModule = {
  tag: {
    name: TAG,
    description:
      'Conteúdos editoriais (v1 apenas rascunho). Todas as rotas exigem a permissão `conteudos`.',
  },
  schemas: {
    ContentListItem: contentListItemSchema,
    ContentDetail: contentDetailSchema,
    ContentList: contentListResponseSchema,
  },
  paths: {
    '/api/v1/contents': {
      get: {
        tags: [TAG],
        operationId: 'listContents',
        summary: 'Listar conteúdos',
        description:
          'Paginado, ordenado por `updatedAt` desc. `q` busca (case-insensitive) no título e no nome do autor. `category=none` filtra sem categoria.',
        security: requiresSession,
        parameters: queryParameters(contentListQuerySchema),
        responses: {
          '200': jsonResponse('Página de conteúdos.', 'ContentList'),
          ...errorResponses(errors),
        },
      },
      post: {
        tags: [TAG],
        operationId: 'createContentDraft',
        summary: 'Criar rascunho',
        description: `Cria conteúdo com \`status: draft\` e \`version: 1\`. ${MEDIA_LINK_RULES}`,
        security: requiresSession,
        requestBody: jsonRequestBody(createContentDraftSchema),
        responses: {
          '201': jsonResponse('Rascunho criado.', 'ContentDetail', locationHeader),
          ...errorResponses({
            ...errors,
            not_found: 'Media asset informado não existe.',
            conflict: 'Media asset não está pronto ou não é vinculável a este tipo.',
          }),
        },
      },
    },
    '/api/v1/contents/{id}': {
      get: {
        tags: [TAG],
        operationId: 'getContent',
        summary: 'Detalhar conteúdo',
        security: requiresSession,
        parameters: pathParameters(contentIdParamSchema),
        responses: {
          '200': jsonResponse('Conteúdo.', 'ContentDetail'),
          ...errorResponses({
            ...errors,
            not_found: 'Conteúdo não encontrado.',
          }),
        },
      },
      patch: {
        tags: [TAG],
        operationId: 'updateContentDraft',
        summary: 'Atualizar rascunho',
        description:
          'Atualização parcial com concorrência otimista: envie `expectedVersion` igual ao `version` atual. ' +
          `Omitir \`mediaAssetId\` preserva o vínculo; \`null\` remove. ${MEDIA_LINK_RULES}`,
        security: requiresSession,
        parameters: pathParameters(contentIdParamSchema),
        requestBody: jsonRequestBody(updateContentDraftSchema),
        responses: {
          '200': jsonResponse('Rascunho atualizado.', 'ContentDetail'),
          ...errorResponses({
            ...errors,
            not_found: 'Conteúdo ou media asset não encontrado.',
            conflict:
              '`expectedVersion` desatualizado, conteúdo fora de rascunho ou media não vinculável.',
          }),
        },
      },
    },
  },
};
