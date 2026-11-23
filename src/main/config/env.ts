import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5176'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  IDENTITY_SEED_ADMIN_EMAIL: z.string().optional(),
  IDENTITY_SEED_ADMIN_PASSWORD: z.string().optional(),
  IDENTITY_SEED_ADMIN_NAME: z.string().default('Admin'),
  REDIS_URL: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_STREAM_API_BASE: z
    .string()
    .default('https://api.cloudflare.com/client/v4'),
  /** Cloudflare Stream HTTP timeout for create/status/token (ms). */
  CLOUDFLARE_STREAM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000),
  /** Customer subdomain code for signed iframe URLs (without "customer-" prefix). */
  CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().optional(),
  /** Optional CSV of allowed origins sent on direct upload creation. */
  CLOUDFLARE_STREAM_ALLOWED_ORIGINS: z.string().optional(),
  /** Max video duration reserved per direct upload (v1 = 900s). */
  MEDIA_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
  /** One-time upload URL TTL / abandoned pending_upload policy (v1 = 900s). */
  MEDIA_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Signed playback token TTL for ADM preview (v1 = 900s). */
  MEDIA_PLAYBACK_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  HTTP_LOG_ENABLED: booleanFlag,
  HTTP_LOG_COLOR: booleanFlag,
  /** Scalar em /docs. Default: ligado fora de produção. */
  API_DOCS_ENABLED: booleanFlag,
  // R2 foundation (documented; not consumed by Media video runtime v1)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
});

type ParsedEnv = z.infer<typeof envSchema>;

export type Env = Omit<
  ParsedEnv,
  'HTTP_LOG_ENABLED' | 'HTTP_LOG_COLOR' | 'API_DOCS_ENABLED'
> & {
  HTTP_LOG_ENABLED: boolean;
  HTTP_LOG_COLOR: boolean;
  API_DOCS_ENABLED: boolean;
};

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const httpLogEnabled =
    data.HTTP_LOG_ENABLED ?? data.NODE_ENV === 'development';
  const httpLogColor =
    data.HTTP_LOG_COLOR ??
    (httpLogEnabled && typeof process.stdout?.isTTY === 'boolean'
      ? process.stdout.isTTY
      : false);

  return {
    ...data,
    HTTP_LOG_ENABLED: httpLogEnabled,
    HTTP_LOG_COLOR: httpLogColor,
    API_DOCS_ENABLED: data.API_DOCS_ENABLED ?? data.NODE_ENV !== 'production',
  };
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
