import { sql } from 'drizzle-orm';
import type { DatabaseHandle } from '../../main/persistence/database';

export type FixtureAuditMarkers = {
  /** Reserved email pattern, e.g. `admin-int-%@example.com` */
  emailLike: string;
  /** Exact fixture actor display name used in audit snapshots */
  actorName: string;
  /** Optional reserved target_label prefix, e.g. `content-int-` */
  targetLabelPrefix?: string;
};

type Db = DatabaseHandle['db'];

function countFrom(rows: unknown): number {
  const first = Array.isArray(rows) ? rows[0] : undefined;
  const value =
    first && typeof first === 'object' && 'count' in first
      ? (first as { count: number }).count
      : 0;
  return Number(value ?? 0);
}

/**
 * Deletes only audit_events belonging to integration fixtures.
 * Safe without FK: scoped by fixture email users, actorName and optional label prefix.
 * Call before deleting identity_users / contents / media_assets.
 */
export async function deleteFixtureAuditEvents(
  db: Db,
  markers: FixtureAuditMarkers,
): Promise<void> {
  await db.execute(sql`
    delete from audit_events
    where actor_user_id in (
      select id from identity_users where email like ${markers.emailLike}
    )
  `);

  await db.execute(sql`
    delete from audit_events
    where actor_name = ${markers.actorName}
  `);

  if (markers.targetLabelPrefix) {
    await db.execute(sql`
      delete from audit_events
      where target_label like ${`${markers.targetLabelPrefix}%`}
    `);
  }
}

/** Counts residual fixture audit_events (post-condition must be 0). */
export async function countFixtureAuditEvents(
  db: Db,
  markers: FixtureAuditMarkers,
): Promise<number> {
  if (markers.targetLabelPrefix) {
    const rows = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from audit_events
      where actor_name = ${markers.actorName}
         or target_label like ${`${markers.targetLabelPrefix}%`}
         or actor_user_id in (
           select id from identity_users where email like ${markers.emailLike}
         )
    `);
    return countFrom(rows);
  }

  const rows = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from audit_events
    where actor_name = ${markers.actorName}
       or actor_user_id in (
         select id from identity_users where email like ${markers.emailLike}
       )
  `);
  return countFrom(rows);
}
