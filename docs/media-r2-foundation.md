# Media — fundação Cloudflare R2 (sem adapter runtime v1)

Status: documentação operacional. **Não** há adapter R2 no runtime Media v1 (vídeo usa Stream).

## Papel do R2

- Object storage S3-compatível para objetos que **não** exigem transcodificação (capas; futuramente áudio/artefatos).
- **Não** é o pipeline de streaming de vídeo.

## Buckets privados por ambiente

| Ambiente | Convenção de nome (exemplo) | Visibilidade |
|----------|-----------------------------|--------------|
| local/dev | `regulamente-media-dev` | privado |
| staging | `regulamente-media-staging` | privado |
| production | `regulamente-media-prod` | privado |

- Um bucket **privado** por ambiente; sem ACL público no objeto.
- Nomes e credenciais **somente** via env (nunca commitados).
- Chaves de objeto geradas pelo backend; **não** aceitar path fornecido pelo cliente.

## CORS para presigned URLs

Presigned URLs **não** enviam header `Authorization` no browser: a assinatura vai na query string. O preflight CORS é tratado pelo R2/S3 automaticamente — **não** liste `OPTIONS` em `AllowedMethods`.

Configuração alvo (ajustar origens ao portal do ambiente):

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://portal.exemplo</AllowedOrigin>
    <!-- somente métodos HTTP reais do fluxo; sem OPTIONS -->
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <!-- incluir DELETE só se o produto assinar DELETE -->
    <AllowedHeader>Content-Type</AllowedHeader>
    <!-- headers efetivamente assinados pelo presign (ex.: x-amz-*); sem Authorization -->
    <AllowedHeader>x-amz-content-sha256</AllowedHeader>
    <AllowedHeader>x-amz-date</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

Regras:

- Origens explícitas do portal (`CORS_ORIGINS` / lista de deploy) — sem `*`.
- `AllowedMethods`: só o método real do fluxo (`GET` download, `PUT` upload, `HEAD` metadata; `DELETE` se aplicável). **Sem `OPTIONS`.**
- `AllowedHeaders`: `Content-Type` e headers que o backend **de fato assina** no presign. **Não** exigir `Authorization` (presigned não o usa).
- `ExposeHeaders`: `ETag` quando o cliente precisar ler a resposta.
- Nesta fatia o upload de **vídeo** vai para Cloudflare Stream (URL de uso único), não R2.

## Credenciais (env)

Documentadas em `.env.example` — valores vazios em repo:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=          # ex.: https://<accountid>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=   # opcional; só se houver CDN/Worker na frente — não expor bucket público
```

Provisionamento (manual / Terraform futuro):

1. Criar bucket privado no account Cloudflare do ambiente.
2. Criar API token / R2 access key com escopo mínimo no bucket.
3. Injetar secrets no runtime (Compose secrets / CI / painel) — **não** no git.
4. Configurar CORS do bucket conforme a seção acima (presigned).

## Runtime v1

- Sem classe/adapter R2 no código de produção desta fatia (evita “adapter morto”).
- Próximo incremento que precisar de capa/objeto estático adiciona port + adapter + testes com fake.
