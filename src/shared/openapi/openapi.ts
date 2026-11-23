import { z } from 'zod';

/**
 * Documentação OpenAPI montada a partir dos schemas Zod da borda HTTP.
 * Apenas documenta: não participa da validação dos handlers.
 */

// Tipos mínimos (subconjunto OpenAPI 3.1 que usamos). JSON Schema fica aberto.
export type OpenApiSchema = { [key: string]: unknown };
export type OpenApiReference = { $ref: string };
export type OpenApiSecurityRequirement = Record<string, string[]>;
export type OpenApiHeader = { description?: string; schema: OpenApiSchema };
export type OpenApiMediaType = {
  schema: OpenApiSchema | OpenApiReference;
  examples?: Record<string, { summary?: string; value: unknown }>;
};
export type OpenApiResponse = {
  description: string;
  headers?: Record<string, OpenApiHeader>;
  content?: Record<string, OpenApiMediaType>;
};
export type OpenApiResponses = Record<string, OpenApiResponse>;
export type OpenApiParameter = {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: OpenApiSchema;
};
export type OpenApiRequestBody = {
  required: boolean;
  description?: string;
  content: Record<string, OpenApiMediaType>;
};
export type OpenApiOperation = {
  tags: string[];
  operationId: string;
  summary: string;
  description?: string;
  /** `[]` = pública. */
  security: OpenApiSecurityRequirement[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: OpenApiResponses;
};
export type OpenApiHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type OpenApiPaths = Record<
  string,
  Partial<Record<OpenApiHttpMethod, OpenApiOperation>>
>;
export type OpenApiTag = { name: string; description?: string };

/** Contribuição de um módulo para o documento OpenAPI. */
export type OpenApiModule = {
  tag: OpenApiTag;
  /** Componentes nomeados (`#/components/schemas/<nome>`). */
  schemas?: Record<string, z.ZodType>;
  paths: OpenApiPaths;
};

export const SESSION_COOKIE_SECURITY_SCHEME = 'sessionCookie';

/** Exige o cookie de sessão `regulamente_session`. */
export const requiresSession: OpenApiSecurityRequirement[] = [
  { [SESSION_COOKIE_SECURITY_SCHEME]: [] },
];

const FORMATS_WITHOUT_PATTERN = new Set(['uuid', 'date-time', 'email']);

export function toOpenApiSchema(
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): OpenApiSchema {
  const json = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    override: ({ jsonSchema }) => {
      // Regex gerada pelo Zod é ruído na doc; o `format` já comunica.
      if (
        typeof jsonSchema.format === 'string' &&
        FORMATS_WITHOUT_PATTERN.has(jsonSchema.format)
      ) {
        delete jsonSchema.pattern;
      }
      // `.int()` injeta ±MAX_SAFE_INTEGER; só limites reais interessam.
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) {
        delete jsonSchema.maximum;
      }
      if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) {
        delete jsonSchema.minimum;
      }
    },
  });
  const { $schema: _dialect, ...rest } = json;
  return rest as OpenApiSchema;
}

export function schemaRef(name: string): OpenApiReference {
  return { $ref: `#/components/schemas/${name}` };
}

function toParameters(
  schema: z.ZodObject,
  location: 'query' | 'path',
): OpenApiParameter[] {
  const json = toOpenApiSchema(schema, 'input');
  const required = new Set((json.required as string[] | undefined) ?? []);
  return Object.entries(
    (json.properties as Record<string, OpenApiSchema> | undefined) ?? {},
  ).map(([name, property]) => {
    const { description, ...propertySchema } = property;
    return {
      name,
      in: location,
      required: location === 'path' || required.has(name),
      ...(typeof description === 'string' ? { description } : {}),
      schema: propertySchema,
    };
  });
}

export function queryParameters(
  schema: z.ZodObject,
): OpenApiParameter[] {
  return toParameters(schema, 'query');
}

export function pathParameters(
  schema: z.ZodObject,
): OpenApiParameter[] {
  return toParameters(schema, 'path');
}

export function jsonRequestBody(
  schema: z.ZodType,
  description?: string,
): OpenApiRequestBody {
  return {
    required: true,
    ...(description ? { description } : {}),
    content: {
      'application/json': { schema: toOpenApiSchema(schema, 'input') },
    },
  };
}

export function jsonResponse(
  description: string,
  schemaName: string,
  headers?: Record<string, OpenApiHeader>,
): OpenApiResponse {
  return {
    description,
    ...(headers ? { headers } : {}),
    content: { 'application/json': { schema: schemaRef(schemaName) } },
  };
}

export const locationHeader: Record<string, OpenApiHeader> = {
  Location: {
    description: 'URL do recurso criado.',
    schema: { type: 'string' },
  },
};

/** Valores estáveis do campo `error` no corpo de erro. */
export const ERROR_CODES = [
  'validation',
  'invalid_credentials',
  'inactive_user',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorBodySchema = z
  .object({
    error: z.enum(ERROR_CODES),
    message: z.string(),
    details: z
      .array(
        z.object({
          path: z.string().optional(),
          message: z.string(),
        }),
      )
      .optional()
      .describe('Presente apenas em `validation`; nunca ecoa valores enviados.'),
  })
  .describe('Corpo padrão de erro.');

export const ERROR_BODY_SCHEMA_NAME = 'ErrorBody';

const ERROR_STATUS: Record<ErrorCode, string> = {
  validation: '400',
  invalid_credentials: '401',
  inactive_user: '401',
  unauthorized: '401',
  forbidden: '403',
  not_found: '404',
  conflict: '409',
  internal: '500',
};

const ERROR_TITLE: Record<string, string> = {
  '400': 'Requisição inválida',
  '401': 'Não autenticado',
  '403': 'Sem permissão',
  '404': 'Não encontrado',
  '409': 'Conflito',
  '500': 'Erro interno',
};

/**
 * Respostas de erro agrupadas por status.
 * `notes` explica quando cada código ocorre nesta rota.
 */
export function errorResponses(
  errors: Partial<Record<ErrorCode, string>>,
): OpenApiResponses {
  const byStatus = new Map<string, Array<[ErrorCode, string]>>();
  for (const [code, note] of Object.entries(errors) as Array<
    [ErrorCode, string]
  >) {
    const status = ERROR_STATUS[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), [code, note]]);
  }

  const responses: OpenApiResponses = {};
  for (const [status, entries] of byStatus) {
    const lines = entries.map(([code, note]) => `- \`${code}\`: ${note}`);
    const examples = Object.fromEntries(
      entries.map(([code, note]) => [
        code,
        { summary: code, value: { error: code, message: note } },
      ]),
    );
    responses[status] = {
      description: `${ERROR_TITLE[status] ?? 'Erro'}\n\n${lines.join('\n')}`,
      content: {
        'application/json': {
          schema: schemaRef(ERROR_BODY_SCHEMA_NAME),
          examples,
        },
      },
    };
  }
  return responses;
}

/** Erros comuns a rotas autenticadas com PermissionKey. */
export function authErrors(
  permission?: string,
): Partial<Record<ErrorCode, string>> {
  return {
    unauthorized: 'Cookie de sessão ausente, inválido ou expirado.',
    ...(permission
      ? { forbidden: `Papel sem a permissão \`${permission}\`.` }
      : {}),
    internal: 'Falha inesperada.',
  };
}

/** Achata interseções (`A & B`) para comparação estrutural. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** `true` se A e B são o mesmo tipo (sem extras nem campos faltando). */
export type Exact<A, B> =
  (<T>() => T extends Simplify<A> ? 1 : 2) extends <T>() => T extends Simplify<B>
    ? 1
    : 2
    ? true
    : false;

/**
 * Falha no typecheck se o schema Zod de resposta divergir do DTO.
 * Uso: `export type _Check = AssertTrue<Exact<z.infer<typeof schema>, Dto>>;`
 */
export type AssertTrue<T extends true> = T;
