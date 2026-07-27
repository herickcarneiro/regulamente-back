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
import { UnavailableMediaUploadProvider } from '../../media/infrastructure/providers/cloudflare-stream-upload.provider';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

const TEST_EMAIL_LIKE = 'content-int-%@example.com';
const TEST_TITLE_PREFIX = 'content-int-';
const TEST_ACTOR_NAME = 'Content Int Editor';

const FIXTURE = {
  emailLike: TEST_EMAIL_LIKE,
  actorName: TEST_ACTOR_NAME,
  targetLabelPrefix: TEST_TITLE_PREFIX,
} as const;

async function cleanup(db: DatabaseHandle['db']) {
  await deleteFixtureAuditEvents(db, FIXTURE);
  await db.execute(
    sql`delete from contents where title like ${`${TEST_TITLE_PREFIX}%`}`,
  );
  await db.execute(
    sql`delete from identity_users where email like ${TEST_EMAIL_LIKE}`,
  );
}

async function countTestContents(db: DatabaseHandle['db']): Promise<number> {
  const rows = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from contents where title like ${`${TEST_TITLE_PREFIX}%`}`,
  );
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return Number(first?.count ?? 0);
}

describe.skipIf(!dockerAvailable)('Content integration (Drizzle/Postgres)', () => {
  let database: DatabaseHandle;
  let app: App;
  const email = `content-int-${Date.now()}@example.com`;
  const password = 'ContentIntSecret1!';
  let cookie = '';

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

      const composed = createIntegrationApp({
        db: database.db,
        users,
        passwords,
        uploadProvider: new UnavailableMediaUploadProvider(),
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
      expect(token).toBeTruthy();
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
      expect(await countTestContents(database.db)).toBe(0);
      expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('persists draft create/list/get/patch with atomic version', async () => {
    const title = `${TEST_TITLE_PREFIX}${Date.now()}`;

    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title,
          type: 'text',
          category: 'sadness',
          body: 'Hello body',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const detail = (await created.json()) as {
      id: string;
      title: string;
      status: string;
      version: number;
      authorName: string;
      body: string;
    };
    expect(detail).toMatchObject({
      title,
      status: 'draft',
      version: 1,
      authorName: TEST_ACTOR_NAME,
      body: 'Hello body',
    });

    const list = await app.handle(
      new Request(
        `http://localhost/api/v1/contents?q=${encodeURIComponent(TEST_TITLE_PREFIX)}&page=1&pageSize=10`,
        { headers: { cookie } },
      ),
    );
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      total: number;
      items: Array<{ id: string }>;
    };
    expect(listBody.total).toBeGreaterThanOrEqual(1);
    expect(listBody.items.some((item) => item.id === detail.id)).toBe(true);

    const patched = await app.handle(
      new Request(`http://localhost/api/v1/contents/${detail.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: 1,
          title: `${title}-v2`,
          category: null,
        }),
      }),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      title: `${title}-v2`,
      version: 2,
      category: null,
      status: 'draft',
    });

    const stale = await app.handle(
      new Request(`http://localhost/api/v1/contents/${detail.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          expectedVersion: 1,
          title: 'stale',
        }),
      }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'conflict' });
  });
});
