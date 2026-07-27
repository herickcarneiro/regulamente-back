import { asc, eq } from 'drizzle-orm';
import type { AdminUser } from '../../core/entities/admin-user.entity';
import { AdminUser as AdminUserEntity } from '../../core/entities/admin-user.entity';
import type { AdminUserRepository } from '../../core/repositories/admin-user.repository';
import type { Database } from '../../../../main/persistence/database';
import { AdminUserMapper } from '../mappers/admin-user.mapper';
import { identityUsers } from '../persistence/identity-users.schema';

export class DrizzleAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const normalized = AdminUserEntity.normalizeEmail(email);
    const rows = await this.db
      .select()
      .from(identityUsers)
      .where(eq(identityUsers.email, normalized))
      .limit(1);
    const row = rows[0];
    return row ? AdminUserMapper.toDomain(row) : null;
  }

  async findById(id: string): Promise<AdminUser | null> {
    const rows = await this.db
      .select()
      .from(identityUsers)
      .where(eq(identityUsers.id, id))
      .limit(1);
    const row = rows[0];
    return row ? AdminUserMapper.toDomain(row) : null;
  }

  async listOrdered(): Promise<AdminUser[]> {
    const rows = await this.db
      .select()
      .from(identityUsers)
      .orderBy(asc(identityUsers.name), asc(identityUsers.id));
    return rows.map((row) => AdminUserMapper.toDomain(row));
  }

  async upsertByEmail(input: {
    id?: string;
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUser['role'];
    active: boolean;
  }): Promise<AdminUser> {
    const email = AdminUserEntity.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    const now = new Date();

    if (existing) {
      const rows = await this.db
        .update(identityUsers)
        .set({
          name: input.name,
          passwordHash: input.passwordHash,
          role: input.role,
          active: input.active,
          updatedAt: now,
        })
        .where(eq(identityUsers.id, existing.id))
        .returning();
      const row = rows[0];
      if (!row) throw new Error('Failed to update identity user');
      return AdminUserMapper.toDomain(row);
    }

    const rows = await this.db
      .insert(identityUsers)
      .values({
        id: input.id ?? crypto.randomUUID(),
        name: input.name,
        email,
        passwordHash: input.passwordHash,
        role: input.role,
        active: input.active,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('Failed to insert identity user');
    return AdminUserMapper.toDomain(row);
  }
}
