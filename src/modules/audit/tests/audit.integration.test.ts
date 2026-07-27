import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { App } from '../../../main/create-app';
import {
  createDatabase,
  type DatabaseHandle,
} from '../../../main/persistence/database';
import { DrizzleUnitOfWork } from '../../../main/persistence/drizzle-unit-of-work';
import { fail } from '../../base/core/result/result';
import { createIntegrationApp } from '../../../shared/testing/create-integration-app';
import {
  countFixtureAuditEvents,
  deleteFixtureAuditEvents,
} from '../../../shared/testing/integration-fixture-cleanup';
import { composeContentService } from '../../content/application/compose-content';
import { LinkedMediaNotFoundError } from '../../content/core/errors/content.errors';
import { DrizzleContentRepository } from '../../content/infrastructure/repositories/drizzle-content.repository';
import { BunPasswordHasher } from '../../identity/infrastructure/crypto/bun-password-hasher';
import { DrizzleAdminUserRepository } from '../../identity/infrastructure/repositories/drizzle-admin-user.repository';
import { SESSION_COOKIE_NAME } from '../../identity/presentation/plugins/session-cookie';
import { UnavailableMediaUploadProvider } from '../../media/infrastructure/providers/cloudflare-stream-upload.provider';
import { composeAuditService } from '../application/compose-audit';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

const TEST_EMAIL_LIKE = 'audit-int-%@example.com';
const TEST_TITLE_PREFIX = 'audit-int-';
const TEST_ACTOR_NAME = 'Audit Int Editor';

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

describe.skipIf(!dockerAvailable)('Audit integration (Drizzle/Postgres)', () => {
  let database: DatabaseHandle;
  let app: App;
  let cookie = '';
  let editorUserId = '';
  const email = `audit-int-${Date.now()}@example.com`;
  const password = 'AuditIntSecret1!';

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    try {
      await cleanup(database.db);

      const users = new DrizzleAdminUserRepository(database.db);
      const passwords = new BunPasswordHasher();
      const passwordHash = await passwords.hash(password);
      const user = await users.upsertByEmail({
        name: TEST_ACTOR_NAME,
        email,
        passwordHash,
        role: 'editor',
        active: true,
      });
      editorUserId = user.id;

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
      expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('persists content create and audit event, then lists them', async () => {
    const title = `${TEST_TITLE_PREFIX} draft`;
    const created = await app.handle(
      new Request('http://localhost/api/v1/contents', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title, type: 'text' }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string };

    const listed = await app.handle(
      new Request(
        'http://localhost/api/v1/audit-events?scope=content&action=content.draft_created',
        { headers: { cookie } },
      ),
    );
    expect(listed.status).toBe(200);
    const events = (await listed.json()) as {
      items: Array<{ targetId: string; targetLabel: string; actorRole: string }>;
    };
    expect(
      events.items.some(
        (item) => item.targetId === body.id && item.targetLabel === title,
      ),
    ).toBe(true);
    expect(events.items[0]?.actorRole).toBe('editor');
  });

  it('rolls back content mutation when audit append fails in the same TX', async () => {
    const title = `${TEST_TITLE_PREFIX} rollback`;
    const unitOfWork = new DrizzleUnitOfWork(database.db);
    const contents = new DrizzleContentRepository(database.db);
    const failingAudit = composeAuditService({
      events: {
        append: async () => {
          throw new Error('forced audit failure');
        },
        list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      },
    });
    const service = composeContentService({
      contents,
      mediaCatalog: {
        findById: async () => fail(new LinkedMediaNotFoundError()),
      },
      audit: failingAudit,
      unitOfWork,
    });

    const before = await database.db.execute<{ count: number }>(
      sql`select count(*)::int as count from contents where title = ${title}`,
    );
    const beforeCount = Number(
      (Array.isArray(before) ? before[0]?.count : 0) ?? 0,
    );

    await expect(
      service.createDraft(
        {
          userId: editorUserId,
          name: TEST_ACTOR_NAME,
          role: 'editor',
        },
        { title, type: 'text' },
      ),
    ).rejects.toThrow('forced audit failure');

    const after = await database.db.execute<{ count: number }>(
      sql`select count(*)::int as count from contents where title = ${title}`,
    );
    const afterCount = Number((Array.isArray(after) ? after[0]?.count : 0) ?? 0);
    expect(afterCount).toBe(beforeCount);

    const auditRows = await database.db.execute<{ count: number }>(
      sql`select count(*)::int as count from audit_events where target_label = ${title}`,
    );
    expect(
      Number((Array.isArray(auditRows) ? auditRows[0]?.count : 0) ?? 0),
    ).toBe(0);
  });
});
