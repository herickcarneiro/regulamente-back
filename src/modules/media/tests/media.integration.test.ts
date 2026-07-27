import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { App } from '../../../main/create-app';
import {
  createDatabase,
  type DatabaseHandle,
} from '../../../main/persistence/database';
import { createIntegrationApp } from '../../../shared/testing/create-integration-app';
import {
  countFixtureAuditEvents,
  deleteFixtureAuditEvents,
} from '../../../shared/testing/integration-fixture-cleanup';
import { BunPasswordHasher } from '../../identity/infrastructure/crypto/bun-password-hasher';
import { DrizzleAdminUserRepository } from '../../identity/infrastructure/repositories/drizzle-admin-user.repository';
import { SESSION_COOKIE_NAME } from '../../identity/presentation/plugins/session-cookie';
import { FakeMediaUploadProvider } from './fakes/in-memory-media';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

const TEST_EMAIL_LIKE = 'media-int-%@example.com';
const TEST_TITLE_PREFIX = 'media-int-';
const TEST_ACTOR_NAME = 'Media Int Editor';

const FIXTURE = {
  emailLike: TEST_EMAIL_LIKE,
  actorName: TEST_ACTOR_NAME,
  targetLabelPrefix: TEST_TITLE_PREFIX,
} as const;

async function cleanup(db: DatabaseHandle['db']) {
  await deleteFixtureAuditEvents(db, FIXTURE);
  await db.execute(
    sql`delete from media_assets where title like ${`${TEST_TITLE_PREFIX}%`}`,
  );
  await db.execute(
    sql`delete from identity_users where email like ${TEST_EMAIL_LIKE}`,
  );
}

async function countTestMedia(db: DatabaseHandle['db']): Promise<number> {
  const rows = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from media_assets where title like ${`${TEST_TITLE_PREFIX}%`}`,
  );
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return Number(first?.count ?? 0);
}

describe.skipIf(!dockerAvailable)('Media integration', () => {
  let database: DatabaseHandle;
  let app: App;
  let cookie: string;
  const email = `media-int-${crypto.randomUUID()}@example.com`;
  const password = 'media-int-secret';
  const uploadProvider = new FakeMediaUploadProvider();

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    try {
      await cleanup(database.db);

      const users = new DrizzleAdminUserRepository(database.db);
      const passwords = new BunPasswordHasher();
      const passwordHash = await passwords.hash(password);
      await users.upsertByEmail({
        name: TEST_ACTOR_NAME,
        email,
        passwordHash,
        role: 'editor',
        active: true,
      });

      uploadProvider.nextUpload = {
        uploadUrl: 'https://upload.example/int-once',
        providerRef: 'int-provider-ref',
      };

      const composed = createIntegrationApp({
        db: database.db,
        users,
        passwords,
        uploadProvider,
      });
      app = composed.app;

      const login = await app.handle(
        new Request('http://localhost/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }),
      );
      expect(login.status).toBe(200);
      const setCookie = login.headers.get('set-cookie');
      const token = setCookie?.split(';')[0]?.split('=')[1];
      cookie = `${SESSION_COOKIE_NAME}=${token}`;
    } catch (error) {
      await cleanup(database.db);
      await database.close();
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await cleanup(database.db);
      expect(await countTestMedia(database.db)).toBe(0);
      expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('persists video upload request and reconciles detail', async () => {
    const created = await app.handle(
      new Request('http://localhost/api/v1/media-assets/video-upload-requests', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          title: `${TEST_TITLE_PREFIX}clip`,
          originalFileName: 'clip.mp4',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string; uploadUrl: string };
    expect(body.uploadUrl).toBe('https://upload.example/int-once');

    uploadProvider.statuses.set('int-provider-ref', {
      status: 'ready',
      durationSeconds: 33,
    });

    const detail = await app.handle(
      new Request(`http://localhost/api/v1/media-assets/${body.id}`, {
        headers: { cookie },
      }),
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      status: 'ready',
      durationSeconds: 33,
    });

    const list = await app.handle(
      new Request('http://localhost/api/v1/media-assets?status=ready', {
        headers: { cookie },
      }),
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { total: number };
    expect(listed.total).toBeGreaterThanOrEqual(1);
  });
});
