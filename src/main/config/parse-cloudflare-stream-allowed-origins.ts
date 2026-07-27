/**
 * Cloudflare Stream `allowedOrigins` expects hostnames (optionally with port),
 * not full URLs with scheme/path.
 *
 * @see https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
 */

const HOST_WITH_OPTIONAL_PORT =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?$/i;

export function parseCloudflareStreamAllowedOrigins(
  value: string | undefined,
): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const origins: string[] = [];
  for (const raw of value.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(entry)) {
      throw new Error(
        `CLOUDFLARE_STREAM_ALLOWED_ORIGINS entry must be a hostname (no scheme): ${entry}`,
      );
    }
    if (entry.includes('/') || entry.includes('?') || entry.includes('#')) {
      throw new Error(
        `CLOUDFLARE_STREAM_ALLOWED_ORIGINS entry must not include path/query: ${entry}`,
      );
    }
    if (!HOST_WITH_OPTIONAL_PORT.test(entry)) {
      throw new Error(
        `CLOUDFLARE_STREAM_ALLOWED_ORIGINS entry is not a valid hostname: ${entry}`,
      );
    }
    origins.push(entry);
  }

  return origins.length > 0 ? origins : undefined;
}
