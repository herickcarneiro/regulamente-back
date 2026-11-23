# API — regulamente-back

Contrato HTTP. OpenAPI é o transporte oficial entre portal e API: Scalar em `/docs`,
spec em `/docs/json` (ver README). Nova rota → documentar em `presentation/openapi/` do módulo;
o teste `src/main/openapi/api-docs.test.ts` falha se alguma rota ficar sem doc.
Contratos detalhados: [identity-contract.md](./identity-contract.md), [content-contract.md](./content-contract.md).

## `GET /health`

`200`:

```json
{ "status": "ok", "service": "regulamente-back" }
```

## Identity v1 (`/api/v1`)

| Método | Path | Auth | Sucesso |
|--------|------|------|---------|
| POST | `/api/v1/auth/login` | pública | `200` SessionDto + `Set-Cookie` |
| POST | `/api/v1/auth/logout` | cookie opcional | `204` |
| GET | `/api/v1/auth/session` | cookie | `200` SessionDto |
| GET | `/api/v1/identity/users` | cookie + `config` | `200` `{ items: AdminUserDto[] }` |

### SessionDto

```json
{ "id": "uuid", "name": "…", "email": "…", "role": "admin|editor|pesquisador|gestor" }
```

### AdminUserDto

```json
{ "id": "uuid", "name": "…", "email": "…", "role": "…", "active": true }
```

### Erros estáveis (`error`)

`validation` · `invalid_credentials` · `inactive_user` · `unauthorized` · `forbidden` · `internal`

Cookie: `regulamente_session` (HttpOnly, SameSite=Lax; `Secure` só com `NODE_ENV=production`).
Compose local default: `NODE_ENV=development` (HTTP sem `Secure`).
Cliente autenticado: `credentials: 'include'`.

## Content v1 (`/api/v1/contents`) — draft-only

Auth em todos: cookie + permissão `conteudos`.

| Método | Path | Sucesso |
|--------|------|---------|
| GET | `/api/v1/contents` | `200` `{ items, total, page, pageSize }` |
| GET | `/api/v1/contents/:id` | `200` ContentDetailDto |
| POST | `/api/v1/contents` | `201` ContentDetailDto (`status: draft`) |
| PATCH | `/api/v1/contents/:id` | `200` ContentDetailDto (`expectedVersion`) |

Query lista: `page`, `pageSize`, `q?`, `status?`, `type?`, `category?` (`none` = null).  
Bodies/queries Zod **strict** — campos desconhecidos → `validation`.  
`ContentDetailDto.mediaAssetId: UUID|null` (lista **não** inclui). Create/update aceitam
`mediaAssetId` opcional; omit no PATCH preserva; `null` remove. Vínculo exige Media
`kind=video` + `status=ready` e Content `type` ∈ {video,mixed}.  
Erros: `validation` · `unauthorized` · `forbidden` · `not_found` · `conflict` · `internal`.  
Fora: Track, publish/pause/archive. Detalhes: [content-contract.md](./content-contract.md).

## Media v1 (`/api/v1/media-assets`)

Auth: cookie + `conteudos`.

| Método | Path | Sucesso |
|--------|------|---------|
| GET | `/api/v1/media-assets` | `200` `{ items, total, page, pageSize }` |
| POST | `/api/v1/media-assets/video-upload-requests` | `201` detail + `uploadUrl` |
| GET | `/api/v1/media-assets/:id` | `200` detail |
| POST | `/api/v1/media-assets/:id/playback-sessions` | `201` `{ playbackUrl, expiresAt }` + header `Cache-Control: no-store` |

`providerRef` nunca no wire. Playback: URL assinada curta, **header obrigatório**
`Cache-Control: no-store`; URL/token sem persistência nem log.
Setup: [cloudflare-setup.md](./cloudflare-setup.md).
Detalhes: [media-contract.md](./media-contract.md).

## Audit v1 (`/api/v1/audit-events`)

Auth: cookie; qualquer papel autenticado (sem PermissionKey).

| Método | Path | Sucesso |
|--------|------|---------|
| GET | `/api/v1/audit-events` | `200` `{ items, total, page, pageSize }` |

Query: `page`, `pageSize`, `scope?`, `action?`, `actorUserId?` — Zod `strictObject`.  
`actorRole` = Identity: `admin` \| `editor` \| `pesquisador` \| `gestor`.  
Detalhes: [audit-contract.md](./audit-contract.md).

## Observabilidade HTTP

Uma linha ao fim da resposta: `HTTP METHOD /pathname STATUS DURATIONms`.  
Silencioso: `OPTIONS`, `/health`. Sem query/body/cookies/Authorization.  
Env: `HTTP_LOG_ENABLED`, `HTTP_LOG_COLOR`.
