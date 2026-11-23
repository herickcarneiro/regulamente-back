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
  createVideoUploadRequestSchema,
  mediaAssetIdParamSchema,
  mediaAssetListQuerySchema,
  mediaAssetListResponseSchema,
  mediaAssetSchema,
  playbackSessionSchema,
  videoUploadResponseSchema,
} from '../schemas/media.schema';

const TAG = 'Media';

const errors = {
  ...authErrors('conteudos'),
  validation: 'Parâmetros ou corpo inválidos (campos desconhecidos são rejeitados).',
};

export const mediaOpenApi: OpenApiModule = {
  tag: {
    name: TAG,
    description:
      'Media assets de vídeo (Cloudflare Stream). Todas as rotas exigem a permissão `conteudos`. ' +
      'Identificadores do provider nunca são expostos.',
  },
  schemas: {
    MediaAsset: mediaAssetSchema,
    MediaAssetList: mediaAssetListResponseSchema,
    VideoUploadRequestCreated: videoUploadResponseSchema,
    PlaybackSession: playbackSessionSchema,
  },
  paths: {
    '/api/v1/media-assets': {
      get: {
        tags: [TAG],
        operationId: 'listMediaAssets',
        summary: 'Listar media assets',
        security: requiresSession,
        parameters: queryParameters(mediaAssetListQuerySchema),
        responses: {
          '200': jsonResponse('Página de media assets.', 'MediaAssetList'),
          ...errorResponses(errors),
        },
      },
    },
    '/api/v1/media-assets/video-upload-requests': {
      post: {
        tags: [TAG],
        operationId: 'createVideoUploadRequest',
        summary: 'Solicitar upload de vídeo',
        description:
          'Cria o asset em `pending_upload` e devolve `uploadUrl` para upload direto ao provider ' +
          '(uso único, TTL curto). Registra o evento `media.video_upload_requested`.',
        security: requiresSession,
        requestBody: jsonRequestBody(createVideoUploadRequestSchema),
        responses: {
          '201': jsonResponse(
            'Upload solicitado.',
            'VideoUploadRequestCreated',
            locationHeader,
          ),
          ...errorResponses({
            ...errors,
            internal: 'Falha inesperada ou provider de vídeo indisponível/não configurado.',
          }),
        },
      },
    },
    '/api/v1/media-assets/{id}': {
      get: {
        tags: [TAG],
        operationId: 'getMediaAsset',
        summary: 'Detalhar media asset',
        description: 'Pode sincronizar o status com o provider antes de responder.',
        security: requiresSession,
        parameters: pathParameters(mediaAssetIdParamSchema),
        responses: {
          '200': jsonResponse('Media asset.', 'MediaAsset'),
          ...errorResponses({
            ...errors,
            not_found: 'Media asset não encontrado.',
          }),
        },
      },
    },
    '/api/v1/media-assets/{id}/playback-sessions': {
      post: {
        tags: [TAG],
        operationId: 'createPlaybackSession',
        summary: 'Criar sessão de playback',
        description:
          'Gera URL assinada de curta duração para preview. A resposta tem `Cache-Control: no-store`; ' +
          'não persista nem logue a URL.',
        security: requiresSession,
        parameters: pathParameters(mediaAssetIdParamSchema),
        responses: {
          '201': jsonResponse('Sessão de playback criada.', 'PlaybackSession', {
            'Cache-Control': {
              description: 'Sempre `no-store`.',
              schema: { type: 'string', const: 'no-store' },
            },
          }),
          ...errorResponses({
            ...errors,
            not_found: 'Media asset não encontrado.',
            conflict: 'Media asset ainda não está `ready`.',
            internal: 'Falha inesperada ou provider de vídeo indisponível/não configurado.',
          }),
        },
      },
    },
  },
};
