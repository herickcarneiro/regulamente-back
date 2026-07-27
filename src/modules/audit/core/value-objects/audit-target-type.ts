export const AUDIT_TARGET_TYPES = [
  'admin_user',
  'content',
  'media_asset',
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export function isAuditTargetType(value: string): value is AuditTargetType {
  return (AUDIT_TARGET_TYPES as readonly string[]).includes(value);
}
