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
import { UnavailableMediaUploadProvider } from '../../media/infrastructure/providers/cloudflare-stream-upload.provider';
import { BunPasswordHasher } from '../infrastructure/crypto/bun-password-hasher';
import { DrizzleAdminUserRepository } from '../infrastructure/repositories/drizzle-admin-user.repository';
import { SESSION_COOKIE_NAME } from '../presentation/plugins/session-cookie';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

/** Emails created by this suite only — never production/smoke admins. */
const TEST_EMAIL_LIKE = 'admin-int-%@example.com';
const TEST_ACTOR_NAME = 'Integration Admin';

const FIXTURE = {
  emailLike: TEST_EMAIL_LIKE,
  actorName: TEST_ACTOR_NAME,
} as const;

async function countAdminIntUsers(db: DatabaseHandle['db']): Promise<number> {
  const rows = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from identity_users where email like ${TEST_EMAIL_LIKE}`,
  );

  const first = Array.isArray(rows) ? rows[0] : undefined;
  return Number(first?.count ?? 0);
}

async function cleanup(db: DatabaseHandle['db']): Promise<void> {
  await deleteFixtureAuditEvents(db, FIXTURE);
  // FK on identity_sessions is ON DELETE CASCADE — sessions go with the user.
  await db.execute(
    sql`delete from identity_users where email like ${TEST_EMAIL_LIKE}`,
  );
}

describe.skipIf(!dockerAvailable)('Identity integration (Drizzle/Postgres)', () => {
  let database: DatabaseHandle;
  let app: App;
  const email = `admin-int-${Date.now()}@example.com`;
  const password = 'IntegrationSecret1!';

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
        role: 'admin',
        active: true,
      });

      const composed = createIntegrationApp({
        db: database.db,
        users,
        passwords,
        uploadProvider: new UnavailableMediaUploadProvider(),
      });
      app = composed.app;
    } catch (error) {
      await cleanup(database.db);
      await database.close();
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await cleanup(database.db);
      expect(await countAdminIntUsers(database.db)).toBe(0);
      expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('persists hashed session token and resolves session from cookie', async () => {
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

    const session = await app.handle(
      new Request('http://localhost/api/v1/auth/session', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      email,
      role: 'admin',
    });
  });
});
