import type { AdminUser } from '../entities/admin-user.entity';

export interface AdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  listOrdered(): Promise<AdminUser[]>;
  upsertByEmail(input: {
    id?: string;
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUser['role'];
    active: boolean;
  }): Promise<AdminUser>;
}
