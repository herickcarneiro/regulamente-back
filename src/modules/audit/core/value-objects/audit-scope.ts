export const AUDIT_SCOPES = ['identity', 'content', 'media'] as const;

export type AuditScope = (typeof AUDIT_SCOPES)[number];

export function isAuditScope(value: string): value is AuditScope {
  return (AUDIT_SCOPES as readonly string[]).includes(value);
}

export function scopeForAction(
  action: import('./audit-action').AuditAction,
): AuditScope {
  if (action.startsWith('identity.')) return 'identity';
  if (action.startsWith('content.')) return 'content';
  return 'media';
}

export function targetTypeForAction(
  action: import('./audit-action').AuditAction,
): import('./audit-target-type').AuditTargetType {
  const scope = scopeForAction(action);
  if (scope === 'identity') return 'admin_user';
  if (scope === 'content') return 'content';
  return 'media_asset';
}
