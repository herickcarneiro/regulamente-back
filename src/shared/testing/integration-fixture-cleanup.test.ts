import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import {
  createDatabase,
  type DatabaseHandle,
} from '../../main/persistence/database';
import {
  countFixtureAuditEvents,
  deleteFixtureAuditEvents,
} from './integration-fixture-cleanup';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

const FIXTURE = {
  emailLike: 'cleanup-fixture-%@example.com',
  actorName: 'Cleanup Fixture Actor',
  targetLabelPrefix: 'cleanup-fixture-',
} as const;

describe.skipIf(!dockerAvailable)('integration fixture audit cleanup', () => {
  let database: DatabaseHandle;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
  });

  afterAll(async () => {
    await database.close();
  });

  it('removes fixture audit_events by email-scoped actor, actorName and target prefix', async () => {
    const email = `cleanup-fixture-${Date.now()}@example.com`;
    const userId = crypto.randomUUID();
    const eventId = crypto.randomUUID();

    await database.db.execute(sql`
      insert into identity_users (id, name, email, password_hash, role, active, created_at, updated_at)
      values (
        ${userId}::uuid,
        ${FIXTURE.actorName},
        ${email},
        'hash:test',
        'editor',
        true,
        now(),
        now()
      )
    `);

    await database.db.execute(sql`
      insert into audit_events (
        id, occurred_at, actor_user_id, actor_name, actor_role,
        action, scope, target_type, target_id, target_label
      ) values (
        ${eventId}::uuid,
        now(),
        ${userId}::uuid,
        ${FIXTURE.actorName},
        'editor',
        'identity.login_succeeded',
        'identity',
        'admin_user',
        ${userId}::uuid,
        ${`${FIXTURE.targetLabelPrefix}login`}
      )
    `);

    expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBeGreaterThan(
      0,
    );

    await deleteFixtureAuditEvents(database.db, FIXTURE);
    await database.db.execute(
      sql`delete from identity_users where email like ${FIXTURE.emailLike}`,
    );

    expect(await countFixtureAuditEvents(database.db, FIXTURE)).toBe(0);
  });
});
