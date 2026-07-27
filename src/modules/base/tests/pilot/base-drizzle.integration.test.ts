import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql, type SQL } from 'drizzle-orm';
import {
  createDatabase,
  type DatabaseHandle,
} from '../../../../main/persistence/database';
import { BaseDrizzleRepository } from '../../infrastructure/repositories/base-drizzle.repository';
import type { BaseMapper } from '../../infrastructure/mappers/base.mapper';
import { PilotItem } from './pilot-item.entity';
import { pilotItems, type PilotItemRow } from './pilot-items.schema';

const databaseUrl = process.env.DATABASE_URL;
const dockerAvailable = Boolean(databaseUrl);

class PilotItemMapper implements BaseMapper<PilotItemRow, PilotItem> {
  toDomain(row: PilotItemRow): PilotItem {
    return PilotItem.restore({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  toRow(entity: PilotItem): PilotItemRow {
    return {
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    };
  }
}

class PilotItemDrizzleRepository extends BaseDrizzleRepository<
  PilotItem,
  { name: string },
  { name: string },
  Record<string, never>,
  PilotItemRow
> {
  constructor(db: DatabaseHandle['db']) {
    super(db, new PilotItemMapper());
  }

  protected get table() {
    return pilotItems;
  }

  protected buildWhere(): SQL | undefined {
    return undefined;
  }

  protected mapCreateValues(dto: { name: string }) {
    return {
      id: crypto.randomUUID(),
      name: dto.name,
    };
  }

  protected mapUpdateValues(dto: { name: string }) {
    return { name: dto.name };
  }
}

describe.skipIf(!dockerAvailable)('BaseDrizzleRepository integration', () => {
  let database: DatabaseHandle;
  let repository: PilotItemDrizzleRepository;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    // Harness table — created only for this suite, never part of deploy migrations.
    await database.db.execute(sql`
      CREATE TABLE IF NOT EXISTS pilot_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz
      )
    `);
    repository = new PilotItemDrizzleRepository(database.db);
  });

  afterAll(async () => {
    await database.db.execute(sql`DROP TABLE IF EXISTS pilot_items`);
    await database.close();
  });

  it('creates and soft-deletes pilot items', async () => {
    const created = await repository.create({ name: `pilot-${Date.now()}` });
    const found = await repository.findById(created.id);
    expect(found?.name).toBe(created.name);

    await repository.delete(created.id);
    const afterDelete = await repository.findById(created.id);
    expect(afterDelete).toBeNull();
  });
});
