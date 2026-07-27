import { z } from 'zod';
import { ROLES } from '../../core/value-objects/role';

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const sessionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(ROLES),
});

export const adminUserDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(ROLES),
  active: z.boolean(),
});

export const adminUsersResponseSchema = z.object({
  items: z.array(adminUserDtoSchema),
});

export const errorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
