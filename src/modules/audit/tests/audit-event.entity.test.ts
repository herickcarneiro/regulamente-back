import { describe, expect, it } from 'bun:test';
import { AuditEvent } from '../core/entities/audit-event.entity';

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  occurredAt: new Date('2026-07-27T12:00:00.000Z'),
  actorUserId: '22222222-2222-4222-8222-222222222222',
  actorName: 'Ana Editor',
  actorRole: 'editor' as const,
  action: 'content.draft_created' as const,
  scope: 'content' as const,
  targetType: 'content' as const,
  targetId: '33333333-3333-4333-8333-333333333333',
  targetLabel: 'Respiração',
};

describe('AuditEvent', () => {
  it('records an immutable event with identity-aligned actorRole', () => {
    const result = AuditEvent.record(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actorRole).toBe('editor');
    expect(result.value.action).toBe('content.draft_created');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('accepts Identity roles pesquisador and gestor', () => {
    for (const actorRole of ['pesquisador', 'gestor'] as const) {
      const result = AuditEvent.record({ ...base, actorRole });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.actorRole).toBe(actorRole);
    }
  });

  it('rejects empty targetLabel and unknown action', () => {
    const emptyLabel = AuditEvent.record({ ...base, targetLabel: '  ' });
    expect(emptyLabel.ok).toBe(false);

    const badAction = AuditEvent.record({
      ...base,
      action: 'content.published' as 'content.draft_created',
    });
    expect(badAction.ok).toBe(false);
  });

  it('rejects mismatched action/scope/targetType combinations', () => {
    const badTarget = AuditEvent.record({
      ...base,
      action: 'content.draft_created',
      scope: 'content',
      targetType: 'admin_user',
    });
    expect(badTarget.ok).toBe(false);

    const badScope = AuditEvent.record({
      ...base,
      action: 'identity.login_succeeded',
      scope: 'content',
      targetType: 'admin_user',
    });
    expect(badScope.ok).toBe(false);

    const mediaOk = AuditEvent.record({
      ...base,
      action: 'media.video_upload_requested',
      scope: 'media',
      targetType: 'media_asset',
      targetId: '44444444-4444-4444-8444-444444444444',
      targetLabel: 'Clip',
    });
    expect(mediaOk.ok).toBe(true);
  });
});
