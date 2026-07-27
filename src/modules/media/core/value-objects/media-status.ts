export const MEDIA_STATUSES = [
  'pending_upload',
  'processing',
  'ready',
  'failed',
] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export function isMediaStatus(value: string): value is MediaStatus {
  return (MEDIA_STATUSES as readonly string[]).includes(value);
}

/** Terminal / higher ranks win; never regress ready/failed to earlier stages. */
const STATUS_RANK: Record<MediaStatus, number> = {
  pending_upload: 0,
  processing: 1,
  ready: 2,
  failed: 2,
};

export function shouldApplyProviderStatus(
  current: MediaStatus,
  next: MediaStatus,
): boolean {
  if (current === next) return false;
  if (current === 'ready' || current === 'failed') {
    return next === 'failed' && current === 'ready'
      ? false
      : STATUS_RANK[next] > STATUS_RANK[current];
  }
  return STATUS_RANK[next] >= STATUS_RANK[current];
}
