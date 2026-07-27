import { AdminUser } from '../../core/entities/admin-user.entity';
import { isRole } from '../../core/value-objects/role';
import type { IdentityUserRow } from '../persistence/identity-users.schema';

export const AdminUserMapper = {
  toDomain(row: IdentityUserRow): AdminUser {
    if (!isRole(row.role)) {
      throw new Error(`Invalid role persisted for user ${row.id}`);
    }

    return AdminUser.restore({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },
};
