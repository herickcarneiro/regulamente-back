import type { Role } from '../value-objects/role';

export const PERMISSION_KEYS = [
  'conteudos',
  'analytics',
  'participantes',
  'exportacao',
  'config',
  'publish',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Canonical Role × PermissionKey matrix — modulos.md §1 / identity-contract. */
export const PERMISSION_MATRIX: Record<PermissionKey, readonly Role[]> = {
  conteudos: ['admin', 'editor'],
  analytics: ['admin', 'pesquisador', 'gestor'],
  participantes: ['admin', 'pesquisador'],
  exportacao: ['admin', 'pesquisador'],
  config: ['admin'],
  publish: ['admin', 'editor', 'gestor'],
};

export function can(role: Role, permission?: PermissionKey): boolean {
  if (permission === undefined) return true;
  return PERMISSION_MATRIX[permission].includes(role);
}
