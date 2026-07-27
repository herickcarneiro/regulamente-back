import { z } from 'zod';
import { CONTENT_STATUSES } from '../../core/value-objects/content-status';
import { CONTENT_TYPES } from '../../core/value-objects/content-type';
import { EMOTION_CATEGORIES } from '../../core/value-objects/emotion-category';

const contentTypeSchema = z.enum(CONTENT_TYPES);
const contentStatusSchema = z.enum(CONTENT_STATUSES);
const emotionCategorySchema = z.enum(EMOTION_CATEGORIES);

export const createContentDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  body: z.string().max(100_000).optional(),
  type: contentTypeSchema,
  category: emotionCategorySchema.nullable().optional(),
  mediaAssetId: z.uuid().nullable().optional(),
});

export const updateContentDraftSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  body: z.string().max(100_000).optional(),
  type: contentTypeSchema.optional(),
  category: emotionCategorySchema.nullable().optional(),
  mediaAssetId: z.uuid().nullable().optional(),
});

export const contentListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: contentStatusSchema.optional(),
  type: contentTypeSchema.optional(),
  category: z.union([emotionCategorySchema, z.literal('none')]).optional(),
});

export const contentIdParamSchema = z.strictObject({
  id: z.uuid(),
});
