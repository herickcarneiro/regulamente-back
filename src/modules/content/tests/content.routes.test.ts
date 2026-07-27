import { describe, expect, it } from 'bun:test';
import type { App } from '../../../main/create-app';
import { createTestApp } from '../../../shared/testing/create-test-app';
import { Content } from '../core/entities/content.entity';
import { AdminUser } from '../../identity/core/entities/admin-user.entity';
import { SESSION_COOKIE_NAME } from '../../identity/presentation/plugins/session-cookie';
import { InMemoryAdminUserRepository } from '../../identity/tests/fakes/in-memory-identity';
import { InMemoryContentRepository } from './fakes/in-memory-content.repository';

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

function buildTestApp(options?: {
  users?: InMemoryAdminUserRepository;
  contents?: InMemoryContentRepository;
}) {
  return createTestApp({
    users: options?.users,
    contents: options?.contents,
    now: () => new Date('2026-07-27T12:00:00.000Z'),
    newId: () => '11111111-1111-4111-8111-111111111111',
  });
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

describe('Content HTTP contract', () => {
  it('returns 401 without cookie', async () => {
    const { app } = buildTestApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/contents'),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'unauthorized' });
  });

  it('returns 403 when role lacks conteudos', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'pesq-1',
      email: 'pesq@example.com',
      role: 'pesquisador',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'pesq@example.com');

    const response = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'forbidden' });
  });

  it('rejects unknown body fields with validation (strict)', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'editor-1',
      email: 'editor@example.com',
      role: 'editor',
      name: 'Editor One',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor@example.com');

    const response = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'X',
          type: 'text',
          status: 'published',
          authorName: 'Hack',
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: string;
      message: string;
    };
    expect(body.error).toBe('validation');
    expect(body.message).toBe('Invalid request');
  });

  it('creates draft 201 with session author and lists/gets', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'editor-1',
      email: 'editor@example.com',
      role: 'editor',
      name: 'Editor One',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor@example.com');

    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Rascunho',
          type: 'video',
          category: 'anxiety',
        }),
      }),
    );

    expect(created.status).toBe(201);
    expect(created.headers.get('location')).toBe(
      '/api/v1/contents/11111111-1111-4111-8111-111111111111',
    );
    const detail = (await created.json()) as {
      id: string;
      title: string;
      type: string;
      category: string | null;
      status: string;
      version: number;
      authorUserId: string;
      authorName: string;
      description: string;
      body: string;
    };
    expect(detail).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Rascunho',
      type: 'video',
      category: 'anxiety',
      status: 'draft',
      version: 1,
      authorUserId: 'editor-1',
      authorName: 'Editor One',
      description: '',
      body: '',
    });

    const list = await app.handle(
      new Request('http://localhost/api/v1/contents?page=1&pageSize=20', {
        headers: { cookie },
      }),
    );
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      total: number;
      page: number;
      pageSize: number;
      items: Array<Record<string, unknown>>;
    };
    expect(listBody.total).toBe(1);
    expect(listBody.page).toBe(1);
    expect(listBody.pageSize).toBe(20);
    expect(listBody.items[0]).toMatchObject({
      id: detail.id,
      title: 'Rascunho',
      authorName: 'Editor One',
    });
    expect(listBody.items[0]).not.toHaveProperty('body');
    expect(listBody.items[0]).not.toHaveProperty('description');

    const get = await app.handle(
      new Request(`http://localhost/api/v1/contents/${detail.id}`, {
        headers: { cookie },
      }),
    );
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({
      id: detail.id,
      body: '',
      description: '',
    });
  });

  it('returns 404 not_found for missing id', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'admin@example.com');

    const response = await app.handle(
      new Request(
        'http://localhost/api/v1/contents/22222222-2222-4222-8222-222222222222',
        { headers: { cookie } },
      ),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
  });

  it('returns 409 conflict for stale version and non-draft', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'editor-1',
      email: 'editor@example.com',
      role: 'editor',
      name: 'Editor One',
    });
    const contents = new InMemoryContentRepository();
    contents.seed(
      Content.restore({
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Published',
        type: 'text',
        category: null,
        status: 'published',
        description: '',
        body: '',
        authorUserId: 'editor-1',
        authorName: 'Editor One',
        mediaAssetId: null,
      version: 2,
        createdAt: new Date('2026-07-27T10:00:00.000Z'),
        updatedAt: new Date('2026-07-27T10:00:00.000Z'),
      }),
    );
    const { app } = buildTestApp({ users, contents });
    const cookie = await loginCookie(app, 'editor@example.com');

    const notEditable = await app.handle(
      new Request(
        'http://localhost/api/v1/contents/33333333-3333-4333-8333-333333333333',
        {
          method: 'PATCH',
          headers: {
            cookie,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ expectedVersion: 2, title: 'Nope' }),
        },
      ),
    );
    expect(notEditable.status).toBe(409);
    expect(await notEditable.json()).toMatchObject({ error: 'conflict' });

    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Draft', type: 'text' }),
      }),
    );
    const draft = (await created.json()) as { id: string };

    const stale = await app.handle(
      new Request(`http://localhost/api/v1/contents/${draft.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ expectedVersion: 99, title: 'Stale' }),
      }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'conflict' });
  });

  it('patches draft successfully bumping version', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'editor-1',
      email: 'editor@example.com',
      role: 'editor',
      name: 'Editor One',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor@example.com');

    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Draft', type: 'text' }),
      }),
    );
    const draft = (await created.json()) as { id: string };

    const patched = await app.handle(
      new Request(`http://localhost/api/v1/contents/${draft.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: 1,
          title: 'Draft v2',
          body: 'Hello',
        }),
      }),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      title: 'Draft v2',
      body: 'Hello',
      version: 2,
      status: 'draft',
    });
  });
});
