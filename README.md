# regulamente-back

API TypeScript do Regulamente — monólito modular Bun/Elysia com Clean Architecture.

## Stack

- Bun + Elysia + Zod v4
- Drizzle ORM v1 RC + Bun SQL (runtime); `postgres.js` para `drizzle-kit migrate`
- PostgreSQL (sessões Identity persistidas); Redis planejado

## Regra de dependência

```text
presentation -> application -> core <- infrastructure
main -> todas as camadas apenas para composição
```

- `core` puro; falhas de negócio via `Result` / `DomainError`
- Identity e Content **não** usam CRUD genérico do Módulo Base
- `shared/` só com código transversal usado por ≥ 2 módulos

## Scripts

```bash
bun run dev
bun run start
bun test
bun run test:coverage
bun run typecheck
bun run lint
bun run db:generate
bun run db:migrate
bun run db:check
bun run db:studio
bun run identity:seed
```

Migrations **nunca** rodam no boot da API. Use o serviço/job `migrate` do Compose
(ou `bun run db:migrate`) antes do deploy. O apply usa runner Bun +
`drizzle-orm/bun-sql/migrator`; `drizzle-kit` fica só para generate/check/studio.

## Docker

```bash
docker compose up --build
```

O Compose local usa `NODE_ENV=${NODE_ENV:-development}` para cookies **sem**
`Secure` em `http://localhost`. Em deploy HTTPS, suba com
`NODE_ENV=production` (ex.: `NODE_ENV=production docker compose up`).

Variáveis de seed: ver `.env.example`.

## Documentação

- [docs/architecture.md](docs/architecture.md)
- [docs/api.md](docs/api.md)
- [docs/identity-contract.md](docs/identity-contract.md)
- [docs/content-contract.md](docs/content-contract.md)
