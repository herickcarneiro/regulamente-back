import { describe, expect, it } from 'bun:test';
import { createTestApp } from '../../../shared/testing/create-test-app';
import { AdminUser } from '../core/entities/admin-user.entity';
import { SESSION_COOKIE_NAME } from '../presentation/plugins/session-cookie';
import { InMemoryAdminUserRepository } from './fakes/in-memory-identity';

function seedAdmin(users: InMemoryAdminUserRepository) {
  users.seed(
    AdminUser.restore({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'hash:secret',
      role: 'admin',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

function readSetCookie(response: Response): string | null {
  return response.headers.get('set-cookie');
}

describe('Identity HTTP contract', () => {
  it('logs in with Set-Cookie and SessionDto body', async () => {
    const users = new InMemoryAdminUserRepository();
    seedAdmin(users);
    const { app } = createTestApp({ users });

    const response = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'secret',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    const cookie = readSetCookie(response);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).not.toContain('Secure');
  });

  it('returns inactive_user without setting a session cookie', async () => {
    const users = new InMemoryAdminUserRepository();
    users.seed(
      AdminUser.restore({
        id: 'inactive-1',
        name: 'Inactive',
        email: 'inactive@example.com',
        passwordHash: 'hash:secret',
        role: 'gestor',
        active: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const { app } = createTestApp({ users });

    const response = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'inactive@example.com',
          password: 'secret',
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: 'inactive_user',
    });
    expect(readSetCookie(response)).toBeNull();
  });

  it('hydrates session and lists users for admin with config', async () => {
    const users = new InMemoryAdminUserRepository();
    seedAdmin(users);
    const { app } = createTestApp({ users });

    const login = await app.handle(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'secret',
        }),
      }),
    );
    const setCookie = readSetCookie(login);
    expect(setCookie).toBeTruthy();
    const token = setCookie?.split(';')[0]?.split('=')[1];
    expect(token).toBeTruthy();

    const session = await app.handle(
      new Request('http://localhost/api/v1/auth/session', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(session.status).toBe(200);

    const listed = await app.handle(
      new Request('http://localhost/api/v1/identity/users', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);

    const logout = await app.handle(
      new Request('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(logout.status).toBe(204);

    const afterLogout = await app.handle(
      new Request('http://localhost/api/v1/auth/session', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(afterLogout.status).toBe(401);
  });
});
