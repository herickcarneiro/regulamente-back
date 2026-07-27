# Audit Contract v1

Status: **IMPLEMENTED** (backend) — wire alinhado a Identity roles.  
Auth: cookie `regulamente_session`; qualquer papel autenticado (sem `PermissionKey`).

## Endpoint

`GET /api/v1/audit-events`

Query (`z.strictObject`):

| Campo | Tipo | Default |
|-------|------|---------|
| `page` | int ≥ 1 | 1 |
| `pageSize` | int 1..100 | 20 |
| `scope?` | `identity` \| `content` \| `media` | — |
| `action?` | ver enum abaixo | — |
| `actorUserId?` | UUID | — |

Ordenação: `occurred_at DESC`, `id ASC`.

## Response 200

```ts
{
  items: Array<{
    id: string;                 // uuid
    occurredAt: string;         // ISO datetime
    actorUserId: string;        // uuid
    actorName: string;
    actorRole: 'admin' | 'editor' | 'pesquisador' | 'gestor';
    action:
      | 'identity.login_succeeded'
      | 'content.draft_created'
      | 'content.draft_updated'
      | 'media.video_upload_requested';
    scope: 'identity' | 'content' | 'media';
    targetType: 'admin_user' | 'content' | 'media_asset';
    targetId: string;           // uuid
    targetLabel: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

## Invariantes

- Append-only: sem update/delete em runtime; sem `updated_at`.
- Só operações bem-sucedidas geram evento.
- `action` ↔ `scope` ↔ `targetType`:
  - identity → `admin_user`
  - content → `content`
  - media → `media_asset`
- Snapshots denormalizados (actor/target); **sem FK** para Identity/Content/Media.
- Atomicidade PostgreSQL (mesma TX):
  - Content create/update + audit
  - Media asset insert + audit (provider Cloudflare fora da TX)
  - Login session + audit

## Erros

`validation` · `unauthorized` · `not_found` · `internal`

## Fora do v1

Backfill, mocks, endpoints de create/update/delete públicos, request logs em `audit_events`.
