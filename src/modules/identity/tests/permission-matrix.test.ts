import { describe, expect, it } from 'bun:test';
import { can } from '../core/authorization/permission-matrix';

describe('permission matrix', () => {
  it('grants config only to admin', () => {
    expect(can('admin', 'config')).toBe(true);
    expect(can('editor', 'config')).toBe(false);
    expect(can('pesquisador', 'config')).toBe(false);
    expect(can('gestor', 'config')).toBe(false);
  });

  it('treats missing permission key as open for authenticated can()', () => {
    expect(can('editor', undefined)).toBe(true);
  });

  it('matches publish roles from modulos.md §1', () => {
    expect(can('gestor', 'publish')).toBe(true);
    expect(can('pesquisador', 'publish')).toBe(false);
  });
});
