export const AUDIT_ACTIONS = [
  'identity.login_succeeded',
  'content.draft_created',
  'content.draft_updated',
  'media.video_upload_requested',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
