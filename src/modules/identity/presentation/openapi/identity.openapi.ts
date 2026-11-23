import type { OpenApiModule } from '../../../../shared/openapi/openapi';
import {
  authErrors,
  errorResponses,
  jsonRequestBody,
  jsonResponse,
  requiresSession,
} from '../../../../shared/openapi/openapi';
import { SESSION_COOKIE_NAME } from '../plugins/session-cookie';
import {
  adminUsersResponseSchema,
  adminUserDtoSchema,
  loginRequestSchema,
  sessionDtoSchema,
} from '../schemas/identity.schema';

const TAG = 'Identity';

export const identityOpenApi: OpenApiModule = {
  tag: {
    name: TAG,
    description:
      'Autenticação por cookie opaco HttpOnly e listagem de usuários internos. ' +
      'Clientes devem usar `credentials: "include"`.',
  },
  schemas: {
    Session: sessionDtoSchema,
    AdminUser: adminUserDtoSchema,
    AdminUserList: adminUsersResponseSchema,
  },
  paths: {
    '/api/v1/auth/login': {
      post: {
        tags: [TAG],
        operationId: 'login',
        summary: 'Login',
        description:
          `Autentica por e-mail e senha. Em sucesso, define o cookie \`${SESSION_COOKIE_NAME}\` ` +
          '(HttpOnly, SameSite=Lax; `Secure` apenas em produção) e registra o evento de auditoria ' +
          '`identity.login_succeeded`.',
        security: [],
        requestBody: jsonRequestBody(loginRequestSchema),
        responses: {
          '200': {
            ...jsonResponse('Sessão criada.', 'Session'),
            headers: {
              'Set-Cookie': {
                description: `Cookie \`${SESSION_COOKIE_NAME}\` com o token opaco da sessão.`,
                schema: { type: 'string' },
              },
            },
          },
          ...errorResponses({
            validation: 'Corpo inválido (e-mail ou senha ausentes/malformados).',
            invalid_credentials: 'E-mail ou senha incorretos.',
            inactive_user: 'Usuário desativado.',
            internal: 'Falha inesperada.',
          }),
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: [TAG],
        operationId: 'logout',
        summary: 'Logout',
        description:
          'Revoga a sessão (se houver) e limpa o cookie. Idempotente: responde 204 mesmo sem cookie.',
        security: [{}, ...requiresSession],
        responses: {
          '204': {
            description: 'Sessão encerrada.',
            headers: {
              'Set-Cookie': {
                description: `Limpa \`${SESSION_COOKIE_NAME}\` (Max-Age=0).`,
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/session': {
      get: {
        tags: [TAG],
        operationId: 'getSession',
        summary: 'Sessão atual',
        description: 'Hidrata a sessão do cliente a partir do cookie.',
        security: requiresSession,
        responses: {
          '200': jsonResponse('Sessão válida.', 'Session'),
          ...errorResponses(authErrors()),
        },
      },
    },
    '/api/v1/identity/users': {
      get: {
        tags: [TAG],
        operationId: 'listAdminUsers',
        summary: 'Listar usuários internos',
        description: 'Requer permissão `config` (papel `admin`).',
        security: requiresSession,
        responses: {
          '200': jsonResponse('Usuários internos.', 'AdminUserList'),
          ...errorResponses(authErrors('config')),
        },
      },
    },
  },
};
