import { z } from 'zod';
import type { AssertTrue, Exact } from '../../../../shared/openapi/openapi';
import type {
  CreateVideoUploadResponseDto,
  MediaAssetDetailDto,
  MediaAssetListItemDto,
  MediaAssetListResponseDto,
  PlaybackSessionDto,
} from '../../application/dtos/media.dto';
import { MEDIA_KINDS } from '../../core/value-objects/media-kind';
import { MEDIA_STATUSES } from '../../core/value-objects/media-status';

const mediaKindSchema = z.enum(MEDIA_KINDS);
const mediaStatusSchema = z.enum(MEDIA_STATUSES);

export const createVideoUploadRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  originalFileName: z.string().trim().min(1).max(255),
});

export const mediaAssetListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: mediaStatusSchema.optional(),
  kind: mediaKindSchema.optional(),
});

export const mediaAssetIdParamSchema = z.strictObject({
  id: z.uuid(),
});

// --- Respostas (documentação OpenAPI; espelham os DTOs da application) ---

export const mediaAssetSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  originalFileName: z.string(),
  kind: mediaKindSchema,
  status: mediaStatusSchema,
  durationSeconds: z
    .number()
    .nullable()
    .describe('Preenchido pelo provider quando o vídeo fica pronto.'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const mediaAssetListResponseSchema = z.object({
  items: z.array(mediaAssetSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const videoUploadResponseSchema = mediaAssetSchema.extend({
  uploadUrl: z
    .url()
    .describe(
      'URL de upload direto (uso único, TTL curto). Envie o arquivo direto ao provider.',
    ),
});

export const playbackSessionSchema = z.object({
  playbackUrl: z
    .url()
    .describe('URL assinada de reprodução. Não persistir nem logar.'),
  expiresAt: z.iso.datetime(),
});

export type _MediaAssetListItemCheck = AssertTrue<
  Exact<z.infer<typeof mediaAssetSchema>, MediaAssetListItemDto>
>;
export type _MediaAssetDetailCheck = AssertTrue<
  Exact<z.infer<typeof mediaAssetSchema>, MediaAssetDetailDto>
>;
export type _MediaAssetListResponseCheck = AssertTrue<
  Exact<z.infer<typeof mediaAssetListResponseSchema>, MediaAssetListResponseDto>
>;
export type _VideoUploadResponseCheck = AssertTrue<
  Exact<z.infer<typeof videoUploadResponseSchema>, CreateVideoUploadResponseDto>
>;
export type _PlaybackSessionCheck = AssertTrue<
  Exact<z.infer<typeof playbackSessionSchema>, PlaybackSessionDto>
>;
