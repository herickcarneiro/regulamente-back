# Content Contract v1 (draft-only)

Status: **APPROVED por Lumen** (2026-07-27) — transporte fechado; nenhuma incompatibilidade objetiva.  
Escopo: fase de contrato de transporte — **sem implementação nesta fase**.  
Alinhado a Identity v1: cookie HttpOnly `regulamente_session`, base `/api/v1`, `ErrorBody` sem ecoar input sensível.

Fontes: pedido de contrato Lumen (UI lista + draft); `regulamente-adm` mocks/páginas Conteúdos/Editor; Identity APPROVED.

---

## 1. Objetivo

Transporte HTTP mínimo para:

1. Listar conteúdos (busca, filtros, paginação).
2. Obter detalhe por id (editor).
3. Criar rascunho (`draft`) — form novo começa **vazio** no cliente; `POST` só ao “Salvar rascunho”.
4. Editar rascunho com concurrency otimista (`expectedVersion`).

**Auth (todos os endpoints):** cookie válido + permissão backend `conteudos`.  
Sem `conteudos` → `403 forbidden`. Sem/ inválido cookie → `401 unauthorized`.

### 1.1 Fora do contrato v1

Campos **omitidos do wire v1** (não existem em request nem response — sem `null` reservado):
`trackLabel`, `sortOrder`, media*, history*.

UI honesta — **sem toast falso / sem dados inventados / sem mock**:

| Fora | Nota UI obrigatória |
|------|---------------------|
| Track (`trackLabel`, ordem na trilha) | Omitido do agregado Content v1; UI não envia nem exibe como dado de API |
| Media (mídia associada, capa) | Omitido; UI não inventa vínculo |
| Histórico / timeline / Audit | **Fora do contrato**; front remove/oculta a seção ou mostra empty/indisponível — **sem mock de eventos falsos** |
| `publish` / `pause` / `archive` | Controles **desabilitados/ocultos** ou copy “indisponível nesta versão” — **sem simular sucesso** (sem toast de publicado/pausado/arquivado) |

---

## 2. Vocabulário de transporte

Enums **em inglês no wire**. Front mapeia labels pt-BR.  
(Identity manteve roles em pt; Content v1 usa inglês estável nos enums de domínio editorial.)

### 2.1 Enumerations

```ts
type ContentStatus =
  | 'draft'       // UI: rascunho
  | 'review'      // UI: revisao / Em revisão
  | 'published'   // UI: publicado
  | 'paused'      // UI: pausado
  | 'archived';    // UI: arquivado

type ContentType =
  | 'video'   // Vídeo
  | 'text'    // Texto
  | 'audio'   // Áudio
  | 'mixed';  // Misto

type EmotionCategory =
  | 'anxiety'   // Ansiedade
  | 'anger'     // Raiva
  | 'sadness'   // Tristeza
  | 'overload'; // Sobrecarga
```

- Leituras (`GET`) podem devolver qualquer `ContentStatus`.
- `POST` / `PATCH` só criam/mantêm `draft`. Bodies/queries Zod **strict**: campos desconhecidos (ex.: `status`, `author`, `authorName`, `trackLabel`) → `400 validation` — **nunca** silenciosamente ignorados/stripped.
- `category: null` = sem categoria (UI `—`).

Filtro de categoria na query: valor enum **ou** `none` (= `category IS NULL`). Omitir = sem filtro.

### 2.2 DTOs

```ts
type ContentListItemDto = {
  id: string;                 // uuid
  title: string;
  type: ContentType;
  category: EmotionCategory | null;
  status: ContentStatus;
  authorName: string;         // snapshot; só servidor
  updatedAt: string;          // ISO-8601
  version: number;            // ≥ 1
};

type ContentDetailDto = ContentListItemDto & {
  description: string;        // vazio → ""
  body: string;               // vazio → ""
  createdAt: string;          // ISO-8601
  authorUserId: string;       // uuid opaco; snapshot na criação
  mediaAssetId: string | null; // UUID opaco Media; só no detail
};

type CreateContentDraftDto = {
  title: string;              // required, trim, min 1, max 200
  description?: string;       // max 2000
  body?: string;              // max 100_000
  type: ContentType;
  category?: EmotionCategory | null;
  mediaAssetId?: string | null; // exige video|mixed + Media ready
};

type UpdateContentDraftDto = {
  expectedVersion: number;    // obrigatório
  title?: string;
  description?: string;
  body?: string;
  type?: ContentType;
  category?: EmotionCategory | null; // null limpa
  mediaAssetId?: string | null; // omit preserva; null remove
};

type ContentListResponseDto = {
  items: ContentListItemDto[];
  total: number;
  page: number;               // 1-based
  pageSize: number;
};

type ErrorBody = {
  error: ContentErrorCode;
  message: string;
  details?: Array<{ path: string; message: string }>; // só validation; sem valores de input
};

type ContentErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal';
```

Notas de transporte:

- **Autor:** nunca no body. `POST` define `authorUserId` = `session.id` e `authorName` = `session.name` (snapshots imutáveis no PATCH v1).
- **Lista:** sem `description`/`body`/`trackLabel`/media/history. `icon` da tabela é derivado no front a partir de `type`.
- **Detalhe:** `description`/`body` sempre string (default `""` se ausentes).
- Content core referencia Identity só por id + snapshot de nome — sem importar entidade Identity.

### 2.3 Envelope de erro HTTP

| HTTP | `error` | Quando |
|------|---------|--------|
| 400 | `validation` | Query/body inválidos. `message`: `Invalid request` |
| 401 | `unauthorized` | Cookie ausente/inválido/expirado ou usuário inativo |
| 403 | `forbidden` | Sem permissão `conteudos` |
| 404 | `not_found` | Conteúdo inexistente (GET/PATCH by id) |
| 409 | `conflict` | (a) `expectedVersion` ≠ versão atual; **ou** (b) PATCH quando `status !== 'draft'` |
| 500 | `internal` | Falha técnica |

Front distingue (a) vs (b) pelo contexto (tinha draft carregado vs status ≠ draft após refetch). Ambos usam o **mesmo** código estável `conflict`.  
Em `409 conflict` por versão: UI recarrega detalhe + mensagem.  
Em `409 conflict` por status não-draft: UI não simula publish — mostra indisponível / volta à lista conforme fluxo do editor.

---

## 3. Endpoints

Base: `/api/v1`. Cliente: `credentials: 'include'`.  
CORS: política Identity (origens explícitas + credentials); methods `GET`, `POST`, `PATCH`, `OPTIONS`.

### 3.1 `GET /api/v1/contents`

| Query | Tipo | Default | Regra |
|-------|------|---------|--------|
| `page` | int ≥ 1 | `1` | 1-based |
| `pageSize` | int 1..100 | `20` | |
| `q` | string | — | trim; busca case-insensitive em `title` **ou** `authorName` |
| `status` | `ContentStatus` | — | filtro exato |
| `type` | `ContentType` | — | filtro exato |
| `category` | `EmotionCategory` \| `'none'` | — | `none` → NULL |

**Sucesso `200`:** `ContentListResponseDto`.

**Ordem estável:** `updatedAt DESC`, depois `id ASC`.

**Erros:** `validation` | `unauthorized` | `forbidden`.

### 3.2 `GET /api/v1/contents/:id`

**Sucesso `200`:** `ContentDetailDto`.  
**Erros:** `validation` (uuid inválido) | `unauthorized` | `forbidden` | `not_found`.

### 3.3 `POST /api/v1/contents`

**Body:** `CreateContentDraftDto` (sem author, sem status).

Servidor:

- `status = 'draft'`
- `version = 1`
- autor da sessão (snapshots)
- `createdAt` / `updatedAt` = now
- `description` / `body` omitidos → `""`

**Sucesso `201`:** `ContentDetailDto` (+ `Location: /api/v1/contents/{id}` recomendado).  
**Erros:** `validation` | `unauthorized` | `forbidden`.

### 3.4 `PATCH /api/v1/contents/:id`

**Body:** `UpdateContentDraftDto` (`expectedVersion` obrigatório; demais partial).

Servidor:

1. Inexistente → `404 not_found`
2. `status !== 'draft'` → `409 conflict` (sem mutar)
3. `expectedVersion !== version` atual → `409 conflict` (sem mutar)
4. Aplica campos presentes; `version += 1`; `updatedAt = now`
5. Não altera author*, `status`, `createdAt`

**Sucesso `200`:** `ContentDetailDto` (versão já incrementada).  
**Erros:** `validation` | `unauthorized` | `forbidden` | `not_found` | `conflict`.

---

## 4. Estados de consumo UI (contrato de comportamento)

| Fluxo | Estados |
|-------|---------|
| Lista | loading / empty (`total === 0`) / error+retry / success |
| Detalhe | loading / `not_found` → voltar lista / error / success |
| Novo | form local **vazio**; `POST` pending em Salvar; success → navegar `/conteudos/:id/editar` (ou lista); validation/rede em banner |
| Editar | `PATCH` pending; `409 conflict` → refetch detalhe + mensagem; botão Publicar indisponível (oculto/desabilitado/copy) — **sem** simular publish |
| Lista (ações sensíveis) | Publicar/Pausar/Arquivar ocultos ou desabilitados com copy “indisponível nesta versão” — **sem** ConfirmDialog → toast de sucesso falso |
| Histórico (editor) | Seção oculta ou empty/indisponível — **sem** timeline mock |

---

## 5. Fronteira Content ↔ Identity

- Sem import de entidade Identity no core Content.
- Persistência: `author_user_id` (uuid) + `author_name` (snapshot no create).
- Sem FK cross-BC obrigatória; autorização via sessão já composta no `main`.

---

## 6. Schema / migration

Tabela `contents` — migration separada/imutável da Identity:
`drizzle/20260727041753_content_foundation/`
(índice lista: `"updated_at" DESC`, `"id"` ASC).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `title` | text not null | |
| `type` | text not null | ∈ ContentType |
| `category` | text null | ∈ EmotionCategory |
| `status` | text not null default `'draft'` | ∈ ContentStatus |
| `description` | text not null default `''` | |
| `body` | text not null default `''` | |
| `author_user_id` | uuid not null | sem FK cross-BC |
| `author_name` | text not null | snapshot |
| `version` | integer not null default 1 | |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz not null | |

Índices: `(updated_at DESC, id ASC)`; `(status)`, `(type)`, `(category)`.

Seed v1 (se houver): **somente** `draft`. Sem published/paused/archived no seed desta fatia.

**Não** há colunas `track_label`, `sort_order`, media, history nesta migration.

---

## 7. Estratégia TDD (plano)

Red → Green → Refactor (`bun:test`):

- Core: create draft; PATCH só draft; bump version; conflict version/status.
- Application: list filters + paginação `page`/`pageSize`; get; create com snapshot de sessão.
- Presentation: 401/403; 201/200 envelopes; 404 `not_found`; 409 `conflict`; validation sanitizada.
- Integração Drizzle + cleanup de fixtures.

---

## 8. Checklist cruzado (Lumen) — fechado

- [x] Paths/métodos: list/get/post/patch sob `/api/v1/contents`
- [x] Version otimista: `expectedVersion` no PATCH
- [x] Author só servidor
- [x] Novo = form vazio + POST no save
- [x] Sem Track/Media/history/publish no contrato
- [x] Filtros/busca/paginação (`page`, `pageSize`, `q`, `status`, `type`, `category`)
- [x] Códigos `conflict` / `not_found` (e demais estáveis)
- [x] **APPROVED explícito de Lumen** (2026-07-27)

---

## 9. Decisões fechadas (alinhadas ao pedido Lumen)

| # | Decisão |
|---|---------|
| 1 | Lista = `ContentListItemDto` **sem** `body`/`description` |
| 2 | Sem `trackLabel` / `sortOrder` / media no wire v1 |
| 3 | Seed só `draft` |
| 4 | Status wire: `draft \| review \| published \| paused \| archived` (inglês) |
| 5 | Erros: `validation \| unauthorized \| forbidden \| not_found \| conflict \| internal` |
| 6 | Um único `409 conflict` para stale version **e** status ≠ draft |

---

## 10. Histórico de revisão

| Data | Evento |
|------|--------|
| 2026-07-27 | Draft Kiln inicial (divergente: `limit`/`version`/erros prefixados/`trackLabel`). |
| 2026-07-27 | Reescrito para transporte Lumen: `pageSize`, DTOs list/detail, `expectedVersion`, erros unificados, escopo negativo UI honesto. |
| 2026-07-27 | **APPROVED por Lumen** — checklist §8 fechado. |
| 2026-07-27 | CHANGES_REQUIRED (review do draft antigo) absorvido: §1.1/§4 reforçam omitir Track no wire, histórico sem mock, publish sem toast falso. Transporte fechado permanece o APPROVED (`pageSize`, `expectedVersion`, `not_found`/`conflict`) — não o draft Kiln inicial (`limit`/`version`/códigos prefixados). |
| 2026-07-27 | Clarificação de segurança (sem mudança de wire): Zod strict — campos desconhecidos no body/query são `validation`, nunca ignorados. |
