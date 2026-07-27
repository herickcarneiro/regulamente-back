import { describe, expect, it } from 'bun:test';
import type { App } from '../../../main/create-app';
import { createTestApp } from '../../../shared/testing/create-test-app';
import { AdminUser } from '../../identity/core/entities/admin-user.entity';
import { SESSION_COOKIE_NAME } from '../../identity/presentation/plugins/session-cookie';
import { InMemoryAdminUserRepository } from '../../identity/tests/fakes/in-memory-identity';
import {
  FakeMediaPlaybackProvider,
  FakeMediaUploadProvider,
  InMemoryMediaAssetRepository,
} from './fakes/in-memory-media';

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
  assets?: InMemoryMediaAssetRepository;
  uploadProvider?: FakeMediaUploadProvider;
  playbackProvider?: FakeMediaPlaybackProvider;
}) {
  return createTestApp({
    users: options?.users,
    assets: options?.assets,
    uploadProvider: options?.uploadProvider,
    playbackProvider: options?.playbackProvider,
    now: () => new Date('2026-07-27T15:00:00.000Z'),
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

describe('Media HTTP contract', () => {
  it('returns 401 without cookie', async () => {
    const { app } = buildTestApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/media-assets'),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'unauthorized' });
  });

  it('returns 403 when role lacks conteudos', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'p1',
      email: 'pesq@media.test',
      role: 'pesquisador',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'pesq@media.test');
    const response = await app.handle(
      new Request('http://localhost/api/v1/media-assets', {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'forbidden' });
  });

  it('rejects unknown body fields with validation (strict)', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e1',
      email: 'editor@media.test',
      role: 'editor',
      name: 'Editor',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor@media.test');
    const response = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Clip',
          originalFileName: 'clip.mp4',
          extra: true,
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'validation' });
  });

  it('creates upload request 201, lists and gets detail', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e2',
      email: 'editor2@media.test',
      role: 'editor',
      name: 'Editor Two',
    });
    const uploadProvider = new FakeMediaUploadProvider();
    const { app, events } = buildTestApp({ users, uploadProvider });
    const cookie = await loginCookie(app, 'editor2@media.test');

    const created = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Clip',
          originalFileName: 'clip.mp4',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string; uploadUrl: string };
    expect(body.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.uploadUrl).toContain('https://');
    expect(
      events.snapshot().some(
        (event) => event.action === 'media.video_upload_requested',
      ),
    ).toBe(true);

    const listed = await app.handle(
      new Request('http://localhost/api/v1/media-assets', {
        headers: { cookie },
      }),
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { items: unknown[]; total: number };
    expect(listBody.total).toBe(1);

    const detail = await app.handle(
      new Request(`http://localhost/api/v1/media-assets/${body.id}`, {
        headers: { cookie },
      }),
    );
    expect(detail.status).toBe(200);
  });

  it('returns 404 not_found for missing asset', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e3',
      email: 'editor3@media.test',
      role: 'editor',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor3@media.test');
    const response = await app.handle(
      new Request(
        'http://localhost/api/v1/media-assets/99999999-9999-4999-8999-999999999999',
        { headers: { cookie } },
      ),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'not_found' });
  });

  it('returns 500 internal when provider unavailable on create', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e4',
      email: 'editor4@media.test',
      role: 'editor',
    });
    const uploadProvider = new FakeMediaUploadProvider();
    uploadProvider.available = false;
    const { app } = buildTestApp({ users, uploadProvider });
    const cookie = await loginCookie(app, 'editor4@media.test');
    const response = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Clip',
          originalFileName: 'clip.mp4',
        }),
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'internal' });
  });

  it('returns 201 playback session with no-store for ready asset', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e5',
      email: 'editor5@media.test',
      role: 'editor',
    });
    const assets = new InMemoryMediaAssetRepository();
    const uploadProvider = new FakeMediaUploadProvider();
    const playbackProvider = new FakeMediaPlaybackProvider();
    const { app } = buildTestApp({
      users,
      assets,
      uploadProvider,
      playbackProvider,
    });
    const cookie = await loginCookie(app, 'editor5@media.test');

    const created = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Ready clip',
          originalFileName: 'ready.mp4',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string };
    uploadProvider.statuses.set('provider-ref-1', {
      status: 'ready',
      durationSeconds: 10,
    });

    const playback = await app.handle(
      new Request(
        `http://localhost/api/v1/media-assets/${body.id}/playback-sessions`,
        { method: 'POST', headers: { cookie } },
      ),
    );
    expect(playback.status).toBe(201);
    expect(playback.headers.has('cache-control')).toBe(true);
    expect(playback.headers.get('cache-control')).toBe('no-store');
    expect(playback.headers.get('Cache-Control')).toBe('no-store');
    const session = (await playback.json()) as {
      playbackUrl: string;
      expiresAt: string;
    };
    expect(session.playbackUrl).toContain('https://');
    expect(session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(session).not.toHaveProperty('providerRef');
  });

  it('returns 409 conflict for playback on pending upload', async () => {
    const users = new InMemoryAdminUserRepository();
    seedUser(users, {
      id: 'e6',
      email: 'editor6@media.test',
      role: 'editor',
    });
    const { app } = buildTestApp({ users });
    const cookie = await loginCookie(app, 'editor6@media.test');

    const created = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Pending',
          originalFileName: 'pending.mp4',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string };

    const playback = await app.handle(
      new Request(
        `http://localhost/api/v1/media-assets/${body.id}/playback-sessions`,
        { method: 'POST', headers: { cookie } },
      ),
    );
    expect(playback.status).toBe(409);
    expect(await playback.json()).toMatchObject({ error: 'conflict' });
  });
});
