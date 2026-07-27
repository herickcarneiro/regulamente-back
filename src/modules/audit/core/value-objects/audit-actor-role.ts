/** Mirrors Identity Role wire — do not invent researcher/manager. */
export const AUDIT_ACTOR_ROLES = [
  'admin',
  'editor',
  'pesquisador',
  'gestor',
] as const;

export type AuditActorRole = (typeof AUDIT_ACTOR_ROLES)[number];

export function isAuditActorRole(value: string): value is AuditActorRole {
  return (AUDIT_ACTOR_ROLES as readonly string[]).includes(value);
}
