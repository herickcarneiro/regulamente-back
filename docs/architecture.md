# Arquitetura — regulamente-back

Monólito modular Bun/Elysia (ADR 002) com Clean Architecture.

## Camadas

| Camada | Responsabilidade |
|---|---|
| `core` | Domínio puro, ports, `Result`, `DomainError` |
| `application` | Orquestração e DTOs |
| `infrastructure` | Drizzle/Bun SQL, crypto, CLIs |
| `presentation` | Elysia, Zod, cookies, CORS |
| `main` | Composition root, env, bootstrap HTTP |

## Regra de dependência

```text
presentation -> application -> core <- infrastructure
main -> todas as camadas apenas para composição
```

## Módulos

- `base` — primitives + CRUD genérico + pilot
- `health` — `GET /health`
- `identity` — auth/sessão/RBAC (core próprio; **não** usa CRUD genérico)
- `content` — conteúdos editoriais draft-only v1 (core próprio; **não** usa CRUD genérico);
  use-cases em `core/use-cases/`; service só orquestra use-cases + DTOs (sem repo);
  referencia Identity só por `author_user_id` + snapshot de nome (sem FK cross-BC);
  referencia Media por `media_asset_id` opaco via ACL `ContentMediaCatalog` (sem FK;
  validação ready antes da TX Content+Audit)
- `media` — media assets vídeo v1 (list/detail/create upload direto + playback session);
  ports `MediaUploadProvider` / `MediaPlaybackProvider` segregados + adapters Cloudflare
  Stream; R2 só documentado (`docs/media-r2-foundation.md`, `docs/cloudflare-setup.md`)
- `audit` — eventos append-only v1 (`GET /api/v1/audit-events`); port interno
  `append` usado por Identity/Content/Media na mesma TX PostgreSQL; sem FK
  cross-BC

Regras Cursor: `.cursor/rules/clean-architecture-backend.mdc` (índice, always)
+ `layer-{core,application,infrastructure,presentation,main}.mdc` por pasta.

## Persistência

- Drizzle ORM `1.0.0-rc.4` + adapter Bun SQL em runtime
- `postgres` (postgres.js) apenas para `drizzle-kit migrate` no Node
- Schema por módulo; barrel de produção em `src/main/persistence/schema.ts`
  (somente módulos deployáveis — harness de teste fica fora)
- Conexão criada uma vez no composition root; fechada no shutdown
- Transações cross-agregado via `UnitOfWork` (`shared/persistence` +
  `DrizzleUnitOfWork`) — Content/Media/Identity login + Audit
- Migrations: job/comando separado (`db:migrate` / Compose `migrate`)
  - Apply via Bun runner `src/main/persistence/migrate.ts` (`drizzle-orm/bun-sql/migrator`)
  - `drizzle-kit` permanece para `generate` / `check` / `studio` (não no apply em produção)

## Observabilidade

- `shared/observability` — plugin Elysia `onAfterResponse` (status final),
  WeakMap para início monotônico; silencioso em `OPTIONS` e `/health`;
  env `HTTP_LOG_ENABLED` / `HTTP_LOG_COLOR`

## Adapters planejados

- Redis: cache/sessão temporária/rate-limit/fila leve (fora do Identity v1)
- `shared/` só recebe código transversal usado por ≥ 2 módulos
