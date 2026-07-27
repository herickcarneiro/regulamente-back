import { describe, expect, it } from 'bun:test';
import { createTestAuditBundle } from '../../../shared/testing/create-test-audit-bundle';
import { AdminUser } from '../core/entities/admin-user.entity';
import { IdentityService } from '../application/services/identity.service';
import {
  FakePasswordHasher,
  FakeTokenService,
  InMemoryAdminUserRepository,
  InMemorySessionRepository,
} from './fakes/in-memory-identity';

function createService(users: InMemoryAdminUserRepository) {
  const auditBundle = createTestAuditBundle();
  return {
    service: new IdentityService({
      users,
      sessions: new InMemorySessionRepository(),
      passwords: new FakePasswordHasher(),
      tokens: new FakeTokenService(),
      sessionTtlSeconds: 28800,
      audit: auditBundle.audit,
      unitOfWork: auditBundle.unitOfWork,
    }),
    events: auditBundle.events,
  };
}

describe('IdentityService', () => {
  it('logs in an active user and returns session without password', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'u1',
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: 'hash:secret',
        role: 'admin',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { service, events } = createService(users);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'secret',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session).toEqual({
      id: 'u1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    expect(result.value.rawToken.length).toBeGreaterThan(10);
    expect(events.snapshot()).toHaveLength(1);
    expect(events.snapshot()[0]?.action).toBe('identity.login_succeeded');
    expect(events.snapshot()[0]?.actorRole).toBe('admin');
  });

  it('distinguishes invalid credentials from inactive users', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'u2',
        name: 'Inactive',
        email: 'inactive@example.com',
        passwordHash: 'hash:secret',
        role: 'editor',
        active: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { service, events } = createService(users);

    const badPassword = await service.login({
      email: 'inactive@example.com',
      password: 'wrong',
    });
    expect(badPassword.ok).toBe(false);
    if (!badPassword.ok) {
      expect(badPassword.error.code).toBe('INVALID_CREDENTIALS');
    }

    const inactive = await service.login({
      email: 'inactive@example.com',
      password: 'secret',
    });
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) {
      expect(inactive.error.code).toBe('INACTIVE_USER');
    }
    expect(events.snapshot()).toHaveLength(0);
  });

  it('forbids listing users without config permission', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'u3',
        name: 'Editor',
        email: 'editor@example.com',
        passwordHash: 'hash:secret',
        role: 'editor',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { service } = createService(users);
    const login = await service.login({
      email: 'editor@example.com',
      password: 'secret',
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const listed = await service.listUsers(login.value.rawToken);
    expect(listed.ok).toBe(false);
    if (!listed.ok) {
      expect(listed.error.code).toBe('FORBIDDEN');
    }
  });

  it('getAuthorizedSession returns session when permission matches', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'u4',
        name: 'Editor',
        email: 'editor2@example.com',
        passwordHash: 'hash:secret',
        role: 'editor',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { service } = createService(users);
    const login = await service.login({
      email: 'editor2@example.com',
      password: 'secret',
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const authorized = await service.getAuthorizedSession(
      login.value.rawToken,
      'conteudos',
    );
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.value).toEqual({
      id: 'u4',
      name: 'Editor',
      email: 'editor2@example.com',
      role: 'editor',
    });
  });

  it('getAuthorizedSession returns unauthorized without token and forbidden without permission', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'u5',
        name: 'Pesquisador',
        email: 'pesq@example.com',
        passwordHash: 'hash:secret',
        role: 'pesquisador',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { service } = createService(users);

    const noToken = await service.getAuthorizedSession(undefined, 'conteudos');
    expect(noToken.ok).toBe(false);
    if (!noToken.ok) {
      expect(noToken.error.code).toBe('UNAUTHORIZED');
    }

    const login = await service.login({
      email: 'pesq@example.com',
      password: 'secret',
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const forbidden = await service.getAuthorizedSession(
      login.value.rawToken,
      'conteudos',
    );
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe('FORBIDDEN');
    }
  });
});
