import { describe, expect, it } from 'bun:test';
import { composeAuditService } from '../application/compose-audit';
import { InMemoryAuditEventRepository } from './fakes/in-memory-audit-event.repository';

const now = new Date('2026-07-27T15:00:00.000Z');

describe('AuditService', () => {
  it('appends and lists events with canonical order and Identity roles', async () => {
    const events = new InMemoryAuditEventRepository();
    let seq = 0;
    const service = composeAuditService({
      events,
      now: () => now,
      newId: () => `evt-${++seq}`,
    });

    const older = await service.append({
      actorUserId: '22222222-2222-4222-8222-222222222222',
      actorName: 'Ana',
      actorRole: 'editor',
      action: 'content.draft_created',
      targetType: 'content',
      targetId: '33333333-3333-4333-8333-333333333333',
      targetLabel: 'Alpha',
    });
    expect(older.ok).toBe(true);

    const newerNow = new Date('2026-07-27T16:00:00.000Z');
    const newerService = composeAuditService({
      events,
      now: () => newerNow,
      newId: () => `evt-${++seq}`,
    });
    const login = await newerService.append({
      actorUserId: '22222222-2222-4222-8222-222222222222',
      actorName: 'Ana',
      actorRole: 'gestor',
      action: 'identity.login_succeeded',
      targetType: 'admin_user',
      targetId: '22222222-2222-4222-8222-222222222222',
      targetLabel: 'Ana',
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    expect(login.value.actorRole).toBe('gestor');

    const listed = await service.list({ page: 1, pageSize: 20 });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items.map((item) => item.action)).toEqual([
      'identity.login_succeeded',
      'content.draft_created',
    ]);
    expect(listed.value.total).toBe(2);

    const filtered = await service.list({
      page: 1,
      pageSize: 20,
      scope: 'content',
    });
    expect(filtered.ok).toBe(true);
    if (!filtered.ok) return;
    expect(filtered.value.items).toHaveLength(1);
    expect(filtered.value.items[0]?.scope).toBe('content');
  });
});
