import { describe, expect, it } from 'bun:test';
import type { App } from '../../../main/create-app';
import { createTestApp } from '../../../shared/testing/create-test-app';
import { AdminUser } from '../../identity/core/entities/admin-user.entity';
import { SESSION_COOKIE_NAME } from '../../identity/presentation/plugins/session-cookie';
import { InMemoryAdminUserRepository } from '../../identity/tests/fakes/in-memory-identity';

function seedUser(
  users: InMemoryAdminUserRepository,
  props: { id: string; email: string; role: AdminUser['role']; name?: string },
) {
  users.seed(
    AdminUser.restore({
      id: props.id,
      name: props.name ?? 'User',
      email: props.email,
      passwordHash: 'hash:secret',
      role: props.role,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

async function loginCookie(app: App, email: string): Promise<string> {
  const response = await app.handle(
    new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'secret' }),
    }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get('set-cookie');
  const token = setCookie?.split(';')[0]?.split('=')[1];
  expect(token).toBeTruthy();
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe('Audit HTTP contract', () => {
  it('returns 401 without cookie', async () => {
    const { app } = createTestApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/audit-events'),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'unauthorized' });
  });

  it('lists events for any authenticated role without PermissionKey', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'pesq@audit.test',
      role: 'pesquisador',
      name: 'Pesquisador',
    });
    const { app } = createTestApp({ users });
    const cookie = await loginCookie(app, 'pesq@audit.test');

    const response = await app.handle(
      new Request('http://localhost/api/v1/audit-events', {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ action: string; actorRole: string }>;
      total: number;
      page: number;
      pageSize: number;
    };
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0]?.action).toBe('identity.login_succeeded');
    expect(body.items[0]?.actorRole).toBe('pesquisador');
  });

  it('rejects unknown query fields with validation (strictObject)', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'editor@audit.test',
      role: 'editor',
    });
    const { app } = createTestApp({ users });
    const cookie = await loginCookie(app, 'editor@audit.test');

    const response = await app.handle(
      new Request('http://localhost/api/v1/audit-events?export=1', {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'validation' });
  });

  it('filters by scope content after draft create', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'editor2@audit.test',
      role: 'editor',
      name: 'Editor',
    });
    const { app } = createTestApp({
      users,
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      newId: () => '11111111-1111-4111-8111-111111111111',
    });
    const cookie = await loginCookie(app, 'editor2@audit.test');

    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Audit draft', type: 'text' }),
      }),
    );
    expect(created.status).toBe(201);

    const response = await app.handle(
      new Request('http://localhost/api/v1/audit-events?scope=content', {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ action: string; scope: string; actorRole: string }>;
    };
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.every((item) => item.scope === 'content')).toBe(true);
    expect(body.items[0]?.action).toBe('content.draft_created');
    expect(body.items[0]?.actorRole).toBe('editor');
  });
});
