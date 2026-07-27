import { z } from 'zod';
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
