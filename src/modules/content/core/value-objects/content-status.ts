export const CONTENT_STATUSES = [
  'draft',
  'review',
  'published',
  'paused',
  'archived',
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: string): value is ContentStatus {
  return (CONTENT_STATUSES as readonly string[]).includes(value);
}
