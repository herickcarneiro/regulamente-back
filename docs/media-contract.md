# Media Contract v1

Status: **APPROVED por Lumen** (2026-07-27) — ACK na nota `media-v1-contrato-e-coorde`; transporte fechado.  
Escopo: listar mídias, criar upload direto de vídeo (uso único), consultar detalhe com reconciliação de status.  
Alinhado a Identity/Content v1: cookie HttpOnly `regulamente_session`, base `/api/v1`, Zod strict, permissão `conteudos`.

Fontes: nota Maestri `media-v1-contrato-e-coorde`; decisões do orquestrador; Identity/Content APPROVED; ACK Lumen.

---

## 1. Objetivo

Transporte HTTP mínimo para:

1. Listar media assets (paginação + filtro `status` / `kind`).
2. Criar pedido de upload direto de vídeo (cria `MediaAsset` + URL de uso único).
3. Obter detalhe por id (reconcilia status do provedor quando `pending_upload`/`processing`).

**Auth (todos os endpoints):** cookie válido + permissão backend `conteudos` via `IdentityService.getAuthorizedSession`.  
Sem `conteudos` → `403 forbidden`. Sem/inválido cookie → `401 unauthorized`.

### 1.1 Fora do contrato v1

| Fora | Nota |
|------|------|
| Áudio / `kind: audio` | Omitido do wire |
| Delete / publish | Fora |
| Patient playback / signed playback URL no app do paciente | Fora |
| TUS resumível / multipart S3 | Fora do v1 — próximo incremento se Basic Direct Upload ≤ 200 MB estiver estável |
| Adapter R2 no runtime | Fundação de config documentada; sem adapter morto |
| Mock de sucesso na UI | Proibido (orquestrador) |

**No escopo adicional (Content link + ADM playback):** vínculo Content↔Media por id
opaco (`contents.media_asset_id` sem FK); `POST .../playback-sessions` para preview
administrativo assinado. Ver nota `content-media-playback-v` e `docs/cloudflare-setup.md`.

**Basic Direct Upload v1 (no escopo):** o cliente envia o arquivo à `uploadUrl` com **um único** `POST multipart/form-data` e campo `file` (contrato Cloudflare Stream Direct Creator Uploads). Isso **não** é TUS.

Limite de arquivo ≤ 200 MB: enforcement de **UI** nesta fatia. O `POST /video-upload-requests` da API não recebe bytes (só metadados + URL de upload de uso único).

---

## 2. Vocabulário de transporte

Enums **em inglês no wire**. Front mapeia labels pt-BR.

### 2.1 Enumerations

```ts
type MediaKind = 'video';

type MediaStatus =
  | 'pending_upload' // aguardando upload do cliente na URL de uso único
  | 'processing'     // provedor recebeu / transcodificando
  | 'ready'          // reproduzível no provedor
  | 'failed';         // falha de upload/processamento
```

### 2.2 DTOs

```ts
type MediaAssetListItemDto = {
  id: string;                 // uuid
  title: string;
  originalFileName: string;
  kind: MediaKind;
  status: MediaStatus;
  durationSeconds: number | null;
  createdAt: string;          // ISO-8601
  updatedAt: string;          // ISO-8601
};

type MediaAssetDetailDto = MediaAssetListItemDto;

type CreateVideoUploadRequestDto = {
  title: string;              // required, trim, min 1, max 200
  originalFileName: string;   // required, trim, min 1, max 255
};

type CreateVideoUploadResponseDto = MediaAssetDetailDto & {
  uploadUrl: string;          // uso único; NUNCA persiste; NUNCA logar
};

type MediaAssetListResponseDto = {
  items: MediaAssetListItemDto[];
  total: number;
  page: number;               // 1-based
  pageSize: number;
};

type ErrorBody = {
  error: MediaErrorCode;
  message: string;
  details?: Array<{ path: string; message: string }>; // só validation; sem valores de input
};

type MediaErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal';
```

Notas:

- `uploadUrl` existe **somente** na resposta `201` de `video-upload-requests`.
- IDs/estados do provedor **não** entram no wire nem como tipos Cloudflare no core.
- Bodies/queries Zod **strict**: campos desconhecidos → `400 validation`.
- **ACK Lumen:** falha/ausência do provedor → `500 internal` (sem `provider_unavailable` no wire v1).

### 2.3 Envelope de erro HTTP

| HTTP | `error` | Quando |
|------|---------|--------|
| 400 | `validation` | Query/body inválidos. `message`: `Invalid request` |
| 401 | `unauthorized` | Cookie ausente/inválido/expirado ou usuário inativo |
| 403 | `forbidden` | Sem permissão `conteudos` |
| 404 | `not_found` | Media asset inexistente |
| 409 | `conflict` | Reservado (sem caso de uso nesta fatia) |
| 500 | `internal` | Falha técnica / provedor indisponível (hipótese) |

---

## 3. Endpoints

Base: `/api/v1`. Cliente: `credentials: 'include'`.  
CORS: política Identity (origens explícitas + credentials); methods `GET`, `POST`, `OPTIONS` (+ `PATCH` já habilitado para Content).

### 3.1 `GET /api/v1/media-assets`

| Query | Tipo | Default | Regra |
|-------|------|---------|--------|
| `page` | int ≥ 1 | `1` | 1-based |
| `pageSize` | int 1..100 | `20` | |
| `status` | `MediaStatus` | — | filtro exato |
| `kind` | `MediaKind` | — | filtro exato |

**Sucesso `200`:** `MediaAssetListResponseDto`.

**Ordem estável:** `updatedAt DESC`, depois `id ASC`.

**Erros:** `validation` | `unauthorized` | `forbidden`.

Lista **não** reconcilia status com o provedor (somente estado local).

### 3.2 `GET /api/v1/media-assets/:id`

**Sucesso `200`:** `MediaAssetDetailDto`.

Quando `status ∈ { pending_upload, processing }`:

1. Se `pending_upload` e `now >= uploadExpiresAt` (campo **interno**, fora do wire) → persiste `failed` (upload abandonado) **sem** chamar o provedor.
2. Caso contrário, consulta o adapter e persiste transição se status/duração mudarem.

**Erros:** `validation` (uuid inválido) | `unauthorized` | `forbidden` | `not_found`.

### 3.3 `POST /api/v1/media-assets/video-upload-requests`

**Body:** `CreateVideoUploadRequestDto`.

Servidor:

1. Valida sessão + `conteudos`.
2. Valida metadados (`title`, `originalFileName`) **antes** de reservar upload no provedor.
3. Pede ao port `MediaUploadProvider` uma URL de upload direto de uso único com `maxDurationSeconds` e `expiry` explícitos (v1: 900s via env/composition).
4. Persiste `MediaAsset` com `kind=video`, `status=pending_upload`, `durationSeconds=null`, `provider_ref` opaco, `upload_expires_at` interno.
5. Devolve `201` + `CreateVideoUploadResponseDto` (+ `Location: /api/v1/media-assets/{id}` recomendado).

**Erros:** `validation` | `unauthorized` | `forbidden` | `internal` (provedor).

**Cliente → Stream (Basic Direct Upload):** `POST multipart/form-data` na `uploadUrl` com campo `file`. Fora do v1: TUS/resumível.

---

## 4. Fronteira Media ↔ Identity / Content / provedores

- Sem import de entidade Identity no core Media; autorização via sessão no `main`/presentation.
- Sem vínculo Content nesta fatia (sem FK / sem endpoint de link).
- Port `MediaUploadProvider` no core; adapter Cloudflare Stream em infrastructure.
- Tipos Cloudflare **não** entram no core/domain.
- R2: object storage S3-compat para capas/artefatos futuros — **não** pipeline de streaming; sem adapter no runtime v1.

---

## 5. Schema / migration

Tabela `media_assets` — migration **nova** e imutável vs Identity/Content:
`drizzle/20260727143959_media_foundation/`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `title` | text not null | |
| `original_file_name` | text not null | |
| `kind` | text not null | ∈ MediaKind |
| `status` | text not null | ∈ MediaStatus |
| `duration_seconds` | integer null | |
| `provider_ref` | text not null | opaco; nunca no wire |
| `upload_expires_at` | timestamptz not null | interno; TTL URL / abandonados; nunca no wire |
| `created_by_user_id` | uuid not null | sem FK cross-BC |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz not null | |

Índices: `(updated_at DESC, id ASC)`; `(status)`; `(kind)`; `(upload_expires_at)`.

Migrations Identity (`20260727033348_identity_foundation`) e Content (`20260727041753_content_foundation`) **não** são alteradas.

**Política v1 uploads abandonados:** `MEDIA_UPLOAD_URL_TTL_SECONDS=900` (default). Na criação, `upload_expires_at = now + TTL` e o adapter Stream recebe o mesmo `expiry`. Em `GET /:id`, `pending_upload` expirado → `failed` sem chamar provedor. `MEDIA_MAX_DURATION_SECONDS=900` (default) reserva capacidade de vídeo; não há default silencioso de 3600.

---

## 6. Cloudflare Stream / R2 (configuração)

Ver `docs/media-r2-foundation.md` (R2) e env documentado em `.env.example`:

```text
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_STREAM_API_BASE=https://api.cloudflare.com/client/v4
CLOUDFLARE_STREAM_TIMEOUT_MS=10000
CLOUDFLARE_STREAM_CUSTOMER_CODE=
# CLOUDFLARE_STREAM_ALLOWED_ORIGINS=localhost:5176,app.example.com
MEDIA_MAX_DURATION_SECONDS=900
MEDIA_UPLOAD_URL_TTL_SECONDS=900
MEDIA_PLAYBACK_TOKEN_TTL_SECONDS=900
# R2 (fundação — não usado pelo runtime Media v1 vídeo)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_BASE_URL=
```

Sem token/account Stream: API sobe; `video-upload-requests` falha com `internal`.
Sem customer code: upload pode funcionar; playback → `internal`.
Guia: `docs/cloudflare-setup.md`.

---

## 7. Estratégia TDD

Red → Green → Refactor (`bun:test`):

- Core: create pending upload; reconcile status transitions; validation title/fileName.
- Application: list filters + paginação; get com reconcile; create com provider fake.
- Presentation: 401/403; 201 create (+ uploadUrl); 200 list/detail; validation strict; not_found.
- Infra: fake provider nos testes; Drizzle repo + migration nova; adapter Stream atrás do port.

---

## 8. Checklist cruzado (Lumen) — fechado

- [x] Paths/métodos aceitos
- [x] Enums `MediaStatus` / `MediaKind` ok
- [x] Create body `{ title, originalFileName }` ok
- [x] `uploadUrl` só no 201 ok
- [x] Erros sem `provider_unavailable` (falha → `internal`) ok
- [x] Sem áudio/delete/publish/patient-playback nesta fatia ok
- [x] Content link + ADM playback session (fatia `content-media-playback-v`)

---

## 9. Histórico de revisão

| Data | Evento |
|------|--------|
| 2026-07-27 | Draft Kiln a partir da nota `media-v1-contrato-e-coorde`; implementação back com hipóteses reversíveis. |
| 2026-07-27 | **APPROVED por Lumen** na nota — checklist §8 fechado; `provider_unavailable` fora do wire v1. |
| 2026-07-27 | CHANGES_REQUIRED Codex: Basic Direct Upload = POST multipart/form-data; TUS fora; maxDuration/TTL 900s; validar antes do provider; abandoned pending→failed; migration regenerada `20260727143959_media_foundation`. |
