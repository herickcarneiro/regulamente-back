# Identity Contract v1 + Plano Técnico

Status: **APPROVED por Lumen** (2026-07-27) — nenhuma incompatibilidade objetiva.  
Escopo: fase de contrato e desenho — **sem implementação de código nesta fase**.  
Fontes: necessidades UI de Lumen; `regulamente-adm/docs/modulos.md` §1; ADR 002; `docs/03-arquitetura/contratos-api.md` (repo pai).

---

## 1. Objetivo da fatia

Expor o contrato HTTP mínimo para:

1. Autenticar o portal com cookie opaco HttpOnly.
2. Hidratar / invalidar sessão no cliente sem persistir token em storage.
3. Listar usuários internos para a tela Usuários & Permissões (`config`).
4. Autorizar no **backend** (fonte de verdade), alinhado à matriz Role × PermissionKey.

Fora desta fatia (botões decorativos no front; sem contrato ainda):

- Convidar usuário / invite.
- Editar papel / update role.
- Toggle ativo/inativo.
- Qualquer mutação que exija `AuditEvent` de produto.

---

## 2. Vocabulário de transporte (não é domínio compartilhado)

Tipos abaixo são **DTOs de API**. O front mapeia para modelos próprios; o back mapeia para o core Identity. Não compartilhar entidades entre projetos.

### 2.1 Enumerations

```ts
type Role = 'admin' | 'editor' | 'pesquisador' | 'gestor';

type PermissionKey =
  | 'conteudos'
  | 'analytics'
  | 'participantes'
  | 'exportacao'
  | 'config'
  | 'publish';
```

Matriz canônica (fonte única de produto — `modulos.md` §1):

| PermissionKey   | Roles |
|-----------------|-------|
| `conteudos`     | admin, editor |
| `analytics`     | admin, pesquisador, gestor |
| `participantes` | admin, pesquisador |
| `exportacao`    | admin, pesquisador |
| `config`        | admin |
| `publish`       | admin, editor, gestor |

Regras de UI já acordadas (não mudam neste contrato):

- Menu com cadeado (item não some).
- `AccessDenied` na rota sem perm.
- Dashboard e Auditoria: autenticado, **sem** `PermissionKey`.
- `can(undefined)` no front = true (rotas abertas autenticadas).
- Usuário `active: false` **não** obtém sessão válida (espelha banner “Usuário inativo…”).

### 2.2 DTOs

```ts
type LoginRequestDto = {
  email: string;
  password: string;
};

type SessionDto = {
  id: string;       // id do AdminUser
  name: string;
  email: string;
  role: Role;
  // Sem token no body. Cookie opaco é o único segredo de sessão.
};

type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

type ErrorBody = {
  error: ErrorCode;
  message: string;
  details?: unknown; // só validation: issues sem valores de input
};

type ErrorCode =
  | 'validation'
  | 'invalid_credentials'
  | 'inactive_user'
  | 'unauthorized'
  | 'forbidden'
  | 'internal';
```

Notas:

- `invalid_credentials` vs `inactive_user` são **distinguíveis** (copy específica no Login).
- Mensagem é para UX/log; o front deve ramificar por `error` (código estável).
- Campos visuais (ex.: `avatarColor`) **não** entram no contrato; o front deriva localmente.

### 2.3 Envelope de erro HTTP

| HTTP | `error` | Quando |
|------|---------|--------|
| 400 | `validation` | Body/query inválidos (Zod na borda). `message` estável (`Invalid request`); `details` só `{ path, message }` — **nunca** ecoa password/body |
| 401 | `invalid_credentials` | Email/senha incorretos (login) |
| 401 | `inactive_user` | Credenciais ok, usuário inativo (login) |
| 401 | `unauthorized` | Cookie ausente/expirado/inválido (session, rotas autenticadas) |
| 403 | `forbidden` | Autenticado sem permissão (ex.: falta `config`) |
| 500 | `internal` | Falha técnica não mapeada |

---

## 3. Endpoints v1

Base path: `/api/v1`.  
Cliente autenticado: `credentials: 'include'` (ou equivalente).  
CORS: origens explícitas + `credentials: true` (ver §5).

### 3.1 `POST /api/v1/auth/login`

**Auth:** pública.  
**Body:** `LoginRequestDto`.  
**Sucesso `200`:**

- Header `Set-Cookie` com cookie de sessão (ver §4).
- Body: `SessionDto`.

**Erros:** `validation` | `invalid_credentials` | `inactive_user`.

Comportamento:

- Senha verificada com Argon2id (`Bun.password.verify` async).
- Usuário inativo → `401 inactive_user` **sem** emitir cookie.
- Credenciais inválidas → `401 invalid_credentials` **sem** revelar se o email existe.
- Sucesso → cria linha em `identity_sessions`, seta cookie, retorna sessão.

### 3.2 `POST /api/v1/auth/logout`

**Auth:** cookie opcional (idempotente).  
**Sucesso `204`:** sem body.

- Invalida a sessão no servidor (delete/revoke da linha correspondente ao cookie).
- `Set-Cookie` de limpeza (Max-Age=0 / expires passado).
- Front limpa apenas estado local de sessão (nunca precisou do valor do cookie).

### 3.3 `GET /api/v1/auth/session`

**Auth:** cookie obrigatório.  
**Sucesso `200`:** `SessionDto`.  
**Erro:** `401 unauthorized` se ausente/expirada/revogada ou se o usuário associado estiver inativo.

Uso UI: bootstrap do `SessionProvider` — loading até resolver; 401 → `/login`; erro de rede → estado retentável.

### 3.4 `GET /api/v1/identity/users`

**Auth:** cookie + permissão `config` (autoridade no backend).  
**Sucesso `200`:**

```json
{ "items": [ /* AdminUserDto[] */ ] }
```

**Erros:** `401 unauthorized` | `403 forbidden`.

Ordenação estável: por `name` asc, depois `id` asc (determinística para a tabela).

### 3.5 Matriz de permissões (decisão v1)

**Sem endpoint dedicado nesta fatia.**

- A matriz canônica Role × PermissionKey é código/config compartilhada **conceitualmente** (alinhada a `modulos.md` §1) e **enforçada no backend**.
- O front continua derivando rótulos da tela (“Conteúdos & mídias”, etc.) a partir da matriz canônica local, como hoje.
- Se no futuro a UI precisar de labels/servidor-driven, adiciona-se `GET /api/v1/identity/permission-matrix` sem breaking change nos endpoints acima.

`PermissionGuard` no front usa role/`can` da sessão já hidratada — **sem fetch próprio**. O backend revalida em toda rota protegida.

---

## 4. Cookie e sessão

| Atributo | Valor |
|----------|--------|
| Nome | `regulamente_session` |
| Valor | token opaco aleatório (ex.: 32+ bytes, encoding url-safe) |
| `HttpOnly` | sim |
| `Secure` | sim quando `NODE_ENV=production`; omitido em `development`/`test` (Compose local HTTP) |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Max-Age` / `Expires` | alinhados à expiração fixa da sessão |

Persistência:

- Servidor **nunca** armazena o token em claro.
- Armazena `token_hash` (SHA-256 do token) + `expires_at` + `user_id`.
- TTL fixo configurável (`SESSION_TTL_SECONDS`, default: `28800` = 8 horas). Sem sliding renewal nesta fatia.
- Logout / usuário inativado → sessão deixa de resolver em `GET session` e rotas protegidas.

Front:

- Não persiste token em `localStorage` / `sessionStorage`.
- Lê apenas `SessionDto` no JSON.
- Envia cookie automaticamente com `credentials: 'include'`.

---

## 5. CORS e segurança de borda

Env:

```text
CORS_ORIGINS=http://localhost:5173,http://localhost:5176
```

Regras:

- Lista explícita de origens (split por vírgula); **sem** `*`.
- `credentials: true` no plugin CORS.
- Methods necessários: `GET`, `POST`, `OPTIONS` (expandir depois para mutações futuras).
- Headers: `Content-Type` (+ os que o front realmente enviar).

Autoridade de autorização:

- Toda rota protegida resolve sessão pelo cookie e aplica a matriz no backend.
- O front usa a matriz só para UX (menu/cadeado/guards); um cliente adulterado não contorna `403`.

Senha:

- Hash Argon2id via `Bun.password.hash` / `Bun.password.verify` (API async).
- Algoritmo fixo Argon2id; parâmetros nos defaults seguros do Bun salvo necessidade documentada.

---

## 6. Modelo relacional (PostgreSQL)

### 6.1 `identity_users`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | `uuid` PK | |
| `name` | `text` not null | |
| `email` | `text` not null unique | normalizado lower-case na escrita |
| `password_hash` | `text` not null | Argon2id |
| `role` | `text` not null | check ∈ Role |
| `active` | `boolean` not null default true | |
| `created_at` | `timestamptz` not null | |
| `updated_at` | `timestamptz` not null | |

Índices: unique(`email`); índice (`active`) opcional.

### 6.2 `identity_sessions`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` not null FK → `identity_users.id` on delete cascade | |
| `token_hash` | `text` not null unique | SHA-256 hex/base64 do cookie |
| `expires_at` | `timestamptz` not null | |
| `created_at` | `timestamptz` not null | |
| `revoked_at` | `timestamptz` null | logout / invalidação |

Índices: unique(`token_hash`); (`user_id`); (`expires_at`).

Não há tabela de permissions — a matriz é constante de domínio/autorização versionada com o código e o doc de produto.

---

## 7. Stack de persistência (decisão)

| Item | Decisão |
|------|--------|
| ORM | **Drizzle ORM v1 RC** (`drizzle-orm@rc` + `drizzle-kit@rc`) |
| Driver runtime | **Bun SQL** nativo via `drizzle-orm/bun-sql` |
| Migrations | SQL gerado por `drizzle-kit generate`; apply via job/CLI (abaixo) |
| Redis | **fora** desta fatia (sessão é PostgreSQL) |

Justificativa: ADR 002 (Bun/Elysia/Drizzle/Postgres); skill Drizzle recomenda v1 RC em projeto novo; docs oficiais Drizzle + Bun SQL.

---

## 8. Seed CLI e migration deploy job

### 8.1 Seed CLI

Comando proposto (fase de implementação):

```bash
bun run src/modules/identity/infrastructure/cli/seed-identity.ts
```

ou script `package.json`: `identity:seed`.

Comportamento:

- Idempotente por email (upsert ou skip se existir).
- Lê credenciais de seed de env (`IDENTITY_SEED_ADMIN_EMAIL`, `IDENTITY_SEED_ADMIN_PASSWORD`, …) — **nunca** hardcode de senha em repo.
- Cria ao menos 1 admin ativo para bootstrap local/CI.
- Opcionalmente espelha o elenco do mock do portal (usuários de demo) sob flag `--demo`, com senhas só via env.

### 8.2 Migration deploy job

Fluxo operacional:

1. CI/CD (ou job de release) executa `bun --bun drizzle-kit migrate` (ou `drizzle-kit migrate` com runner Bun) **antes** de subir a nova versão da API.
2. App **não** auto-migra no boot de produção (evita race multi-instância).
3. Dev local: `bun run db:migrate` + `bun run identity:seed`.
4. Rollback de schema: processo operacional separado (não inventar auto-rollback nesta fatia).

---

## 9. Arquitetura do módulo Identity (plano, sem código)

Identity é contexto **genérico** (`context-map.md`) e **não** deve ser forçado no CRUD genérico do Módulo Base.

Motivo: login/logout/session, hashing, cookies, autorização e invariante “inativo não autentica” não são CRUD de recurso; forçar `registerCrudRoutes` distorce o agregado.

Estrutura alvo:

```text
src/modules/identity/
  core/            # AdminUser, Session ports, use-cases (login, logout, getSession, listUsers, authorize)
  application/     # services + DTOs internos de aplicação
  infrastructure/  # Drizzle repos, mappers, password hasher (Bun.password), token hasher
  presentation/    # rotas auth + users, schemas Zod, cookie helpers, mapDomainError
  tests/           # TDD por camada; integração cookie+DB
```

Ports tipados no core; adapters injetados no composition root.  
Presentation nunca importa infrastructure.

Autorização:

- Port/use-case `authorize(role, permissionKey)` (ou equivalente) no core Identity.
- Middleware/hook Elysia em presentation resolve sessão e chama autorização — regras de negócio da matriz ficam no core, não no hook.

---

## 10. Plano do Módulo Base completo (pilot)

Identity **não** depende do CRUD genérico. Em paralelo (ou imediatamente antes de módulos CRUD reais), completar o Módulo Base e validar com `tests/pilot/`.

### 10.1 Entregáveis do Base

| Camada | Peças |
|--------|--------|
| core | `Entity`, `Result` (já iniciada), `DomainError`, `NotFoundError`, `InvalidInputError`, `Repository<T…>`, use-cases CRUD genéricos, `PaginatedEntity` |
| application | `BaseCrudService`, `PaginationDTO` |
| infrastructure | `BaseDrizzleRepository`, `BaseMapper` |
| presentation | `registerCrudRoutes`, `mapDomainErrorToStatus` |
| tests/pilot | módulo fake mínimo ponta a ponta (5 verbos) |

### 10.2 Ordem TDD (pilot)

1. Primitives (`Result`, `DomainError`, `Entity`) — unitário.
2. Use-cases CRUD genéricos com fake repo.
3. `BaseCrudService` com fakes.
4. `registerCrudRoutes` via `app.handle()` + fake service.
5. Integração `BaseDrizzleRepository` + tabela pilot em Postgres de teste.
6. Gate: qualquer mudança no Base só mergeia com pilot verde.

### 10.3 Regra de adoção

- CRUD simples → estende Base.
- Agregado com invariantes / fluxos não-CRUD (Identity, publish, export…) → core próprio.
- `shared/` só recebe código transversal usado por **≥ 2 módulos** reais (não planejamento).

---

## 11. Estados de consumo UI (contrato ↔ UX)

| Fluxo UI | Contrato |
|----------|----------|
| Login pending | aguarda `POST login` |
| Banner inativo | `401` + `error: inactive_user` |
| Erro genérico login | `invalid_credentials` / `validation` / rede |
| Sucesso login | cookie + `SessionDto` → Dashboard |
| Bootstrap SessionProvider | `GET session` até resolver |
| 401 no bootstrap | redireciona `/login` |
| PermissionGuard | usa sessão hidratada; backend reforça |
| UserPage lista | `GET identity/users`; loading/empty/error |
| 403 lista | sem `config` |

“Esqueci minha senha”, Convidar e Editar: **sem endpoint** nesta fatia.

---

## 12. Fora de escopo explícito

- Invite / update role / toggle active / AuditEvent dessas mutações.
- Refresh token / sliding sessions / 2FA.
- Redis para sessão.
- OpenAPI snapshot + client gerado (próximo passo de orquestração após implementação).
- Endpoint de permission-matrix.
- Compartilhar tipos de domínio com o frontend.

---

## 13. Checklist de alinhamento Lumen

- [x] Paths e métodos aceitos.
- [x] `SessionDto` / `AdminUserDto` / `LoginRequestDto` shapes ok.
- [x] Códigos `invalid_credentials` vs `inactive_user` vs `unauthorized` vs `forbidden` vs `validation` suficientes para a UI.
- [x] Cookie HttpOnly + body sem token ok.
- [x] Sem endpoint de matriz nesta fatia (front deriva labels) ok.
- [x] `GET /api/v1/identity/users` envelope `{ items }` ok.
- [x] Logout `204` ok.
- [x] Nenhuma mutação de papel/status/invite nesta fatia ok.

---

## 14. Histórico de revisão

| Data | Agente | Resultado |
|------|--------|-----------|
| 2026-07-27 | Kiln | Rascunho v1 enviado a Lumen |
| 2026-07-27 | Lumen | **APPROVED** — nenhuma incompatibilidade objetiva |
| 2026-07-27 | Kiln | Default `SESSION_TTL_SECONDS` documentado como 8h (28800) na implementação; sem mudança de endpoint/DTO/error |
| 2026-07-27 | Kiln + Lumen | Sanitização de `validation` (sem eco de senha/body); Lumen ACK — front ramifica por `error` |
| 2026-07-27 | Kiln | Compose local: `NODE_ENV=${NODE_ENV:-development}` para cookie HTTP sem `Secure`; produção explícita mantém `Secure` |
