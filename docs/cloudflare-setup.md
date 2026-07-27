# Cloudflare Stream / R2 setup (sem segredos)

Guia operacional para Media v1 (upload + playback ADM). **Nunca** commitar tokens,
account IDs reais ou customer codes em docs, PRs ou notas públicas — use
`.env` / secrets do ambiente.

## Variáveis Stream

| Variável | Obrigatória para | Notas |
|----------|------------------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | Upload + playback | Account Cloudflare |
| `CLOUDFLARE_API_TOKEN` | Upload + playback | Token com permissão Stream Edit |
| `CLOUDFLARE_STREAM_API_BASE` | opcional | Default `https://api.cloudflare.com/client/v4` |
| `CLOUDFLARE_STREAM_TIMEOUT_MS` | opcional | Default `10000` |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | **Playback** | Código do subdomain (sem prefixo `customer-`) |
| `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` | opcional | CSV de **hostnames** (ex. `localhost:5176,app.example.com`) — sem `http(s)://` nem path |
| `MEDIA_MAX_DURATION_SECONDS` | opcional | Default `900` |
| `MEDIA_UPLOAD_URL_TTL_SECONDS` | opcional | Default `900` |
| `MEDIA_PLAYBACK_TOKEN_TTL_SECONDS` | opcional | Default `900` |

### Comportamento sem credenciais

- Sem account/token: API sobe; `POST .../video-upload-requests` → `500 internal`.
- Sem `CLOUDFLARE_STREAM_CUSTOMER_CODE`: upload pode funcionar; `POST .../playback-sessions` → `500 internal` (provider playback indisponível).

## Direct Creator Upload

1. Backend cria direct upload (`requireSignedURLs: true`).
2. Cliente faz **POST multipart/form-data** campo `file` na `uploadUrl` (Basic Upload; TUS fora do v1).
3. Limite UI ADM: 200 MB (contrato front).

## Playback ADM (assinado)

1. `POST /api/v1/media-assets/:id/playback-sessions` (auth + `conteudos`).
2. Backend chama `POST /accounts/{id}/stream/{uid}/token` com `exp`.
3. Resposta 201: `{ playbackUrl, expiresAt }` — iframe
   `https://customer-{code}.cloudflarestream.com/{token}/iframe`.
4. Token/URL **não** são persistidos nem logados; `Cache-Control: no-store`.

## R2

Fundação documentada em `docs/media-r2-foundation.md`. Não usada pelo runtime
de vídeo Stream v1.

## Compose local

`compose.yaml` repassa as variáveis Stream/playback via `${VAR:-}`. Preencha
`.env` local (não versionado) antes de `docker compose up`.
