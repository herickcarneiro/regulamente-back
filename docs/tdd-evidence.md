# Evidência TDD

## Identity login route

**RED** (`auth.routes.red.test.ts`, antes da wiring):

```text
Expected: not 404
Received: 404
(fail) Identity auth contract (RED until wired) > POST /api/v1/auth/login is reachable
```

**GREEN** (`auth.routes.test.ts` após implementação): suite Identity HTTP contract passa
(`login` 200 + cookie, `inactive_user`, session/users/logout).

## Base module

Pilot `registerCrudRoutes` e `BaseCrudService` escritos com falha inicial implícita
(imports/comportamento ausentes) e verdes após implementação do Módulo Base.

## Content v1 (draft-only)

### Core entity

**RED** (antes de `content.entity.ts`):

```text
error: Cannot find module '../core/entities/content.entity'
0 pass / 1 fail / 1 error
```

**GREEN:** `content.entity.test.ts` — 6 pass (create draft, empty title, bump version,
`VERSION_CONFLICT`, `CONTENT_NOT_EDITABLE`, clear category).

### Application service

**RED** (antes de `content.service.ts`):

```text
error: Cannot find module '../application/services/content.service'
0 pass / 1 fail / 1 error
```

**GREEN:** `content.service.test.ts` — 5 pass (create snapshot, list/q/order, not_found,
atomic update, distinct domain conflict codes).

### HTTP (`app.handle`)

**GREEN:** `content.routes.test.ts` — 7 pass:

- 401 unauthorized
- 403 forbidden (pesquisador sem `conteudos`)
- 400 validation (strict: `status`/`authorName` rejeitados)
- 201 create + list envelope + get detail
- 404 `not_found`
- 409 `conflict` (non-draft + stale `expectedVersion`)
- 200 PATCH bump version

### Integração Drizzle

`content.integration.test.ts` — `describe.skipIf(!DATABASE_URL)`; com Postgres:
create/list/get/patch + stale 409; cleanup por prefixo `content-int-` / email
`content-int-%@example.com`.

### Use-cases Content (refactor arquitetural)

**RED:** `content.use-cases.test.ts` — módulos `core/use-cases/*` ausentes.

**GREEN:** create/get/list/update use-cases; `ContentService` só injeta use-cases +
mapeia DTO (`composeContentService`); sem `ContentRepository` no service.

### Revisão final Content (índice + auth)

**RED:**
- `contents-index.test.ts` — migration tinha `("updated_at","id")` sem DESC
- `identity.service.test.ts` — `getAuthorizedSession` inexistente

**GREEN:**
- Schema `table.updatedAt.desc(), table.id.asc()` + migration regenerada
  `20260727041753_content_foundation` (`"updated_at" DESC NULLS LAST,"id"`)
- `IdentityService.getAuthorizedSession`; Content routes + `listUsers` reutilizam
- Comentário do repo: mutação atômica; classificação de erro pós-read sem
  garantia TOCTOU-free

## Media v1 (video upload)

### Core entity

**RED:** `media-asset.entity.test.ts` — módulo ausente (`Cannot find module`).

**GREEN:** 5 pass (create pending_upload, validation title/fileName, reconcile
processing→ready, no regress ready→pending_upload).

### Use-cases / service

**RED:** `media.service.test.ts` — `compose-media` ausente.

**GREEN:** use-cases 4 pass; service 2 pass (uploadUrl só no create; not_found).

### HTTP (`app.handle`) + fake provider

**RED:** rotas `/api/v1/media-assets*` ausentes → 500 internal (Elysia not found).

**GREEN:** `media.routes.test.ts` — 6 pass (401/403/validation strict/201+list+detail
reconcile/404/500 provider unavailable).

### Adapter Cloudflare Stream

**GREEN:** `cloudflare-stream.provider.test.ts` — direct upload + status map +
`UnavailableMediaUploadProvider` (fetch fake; sem segredo).

### Integração Drizzle

`media.integration.test.ts` — `describe.skipIf(!DATABASE_URL)`; create/list/get
+ reconcile com fake provider; cleanup `media-int-`.

Migration nova: `drizzle/20260727143959_media_foundation/` (Identity/Content
imutáveis). Inclui `upload_expires_at` interno.

### CHANGES_REQUIRED Codex (upload policy)

**RED:**
- entity: `markAbandonedIfExpired` ausente
- use-case: input inválido ainda chamava provider; `uploadExpiresAt` ausente;
  pending expirado permanecia `pending_upload`

**GREEN:**
- validação de metadados **antes** do provider (`createCalls.length === 0`)
- `MEDIA_MAX_DURATION_SECONDS` / `MEDIA_UPLOAD_URL_TTL_SECONDS` = 900 (env + composition)
- adapter Stream envia `expiry` + `maxDurationSeconds: 900`
- `GET /:id` abandona `pending_upload` expirado → `failed` sem chamar provider
- contrato: Basic Direct Upload = POST multipart/form-data; TUS fora

### Provider timeout + R2 CORS docs

**RED:** fetch sem `AbortSignal`; timeout tests hang (5s runner).

**GREEN:** `fetchWithTimeout` + `AbortSignal` em create/status; timeout →
`MEDIA_PROVIDER_UNAVAILABLE` (= wire `internal`); `CLOUDFLARE_STREAM_TIMEOUT_MS`
(default 10000). R2 doc: CORS presigned sem OPTIONS/Authorization; métodos reais
+ ExposeHeaders ETag.

## Audit v1 + observabilidade HTTP

### HTTP logger (`shared/observability`)

**RED:** `http-log-plugin.test.ts` — módulo ausente; depois falhou até
`onAfterResponse` + await do `write` fake (handle resolve antes do hook).

**GREEN:** exatamente 1 linha para 201 / validação 400 / 401 / 404 / 500;
silêncio OPTIONS+/health; sem query/Authorization; `onRequest` sem retornar
`WeakMap.set`.

### AuditEvent + invariantes

**RED:** entidade ausente; combinação `content`+`admin_user` ainda aceita.

**GREEN:** imutável; roles Identity; rejeita action/scope/targetType inválidos.

### Service / HTTP / integração

**GREEN:** `audit.service.test.ts`, `audit.routes.test.ts` (401, list sem
PermissionKey, strictObject, filtro scope).

**Integração:** create Content → evento listável; append forçado a falhar →
rollback da mutação `contents` (mesma TX). Migration
`drizzle/20260727151659_audit_foundation/` — `audit_events` sem FK.

## Content ↔ Media + playback v1

### Entity + ACL

**RED:** `content.entity.test.ts` — `mediaAssetId` ainda aceito com type text;
clear null indefinido.

**GREEN:** invariante type∈{video,mixed} ↔ mediaAssetId; clear null; port
`ContentMediaCatalog` + `assertLinkableMediaAsset` antes da TX.

### Service / HTTP

**GREEN:** link ready → detail com `mediaAssetId`; unknown → `NOT_FOUND`;
processing → `CONFLICT`; omit preserva / null remove. Lista sem `mediaAssetId`.

### Playback

**RED→GREEN:** `MediaPlaybackProvider` segregado; `POST .../playback-sessions`
201 `{ playbackUrl, expiresAt }` + `Cache-Control: no-store`; conflict se não
ready; sem customer code → `internal`. Cloudflare token fora da TX.

**RED→GREEN (segurança Cache-Control):** teste HTTP
`returns 201 playback session with no-store for ready asset` — sem header →
`Received: null`; `set.headers['cache-control']` não era confiável no Response de
`app.handle`; GREEN com `Response.json(..., { headers: { 'Cache-Control': 'no-store' } })`.
URL/token sem persistência/log.

### Migration

Nova: `drizzle/20260727180517_content_media_link/` — `contents.media_asset_id`
UUID nullable + índice + check local (sem FK). Foundations Identity/Content/
Media/Audit **imutáveis**.
