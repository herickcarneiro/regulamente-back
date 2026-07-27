import { AdminUser } from '../../core/entities/admin-user.entity';
import { Session } from '../../core/entities/session.entity';
import type { AdminUserRepository } from '../../core/repositories/admin-user.repository';
import type { PasswordHasher } from '../../core/repositories/password-hasher';
import type { SessionRepository } from '../../core/repositories/session.repository';
import type { TokenService } from '../../core/repositories/token-service';
import { createHash, randomBytes } from 'node:crypto';

export class InMemoryAdminUserRepository implements AdminUserRepository {
  private readonly users = new Map<string, AdminUser>();

  seed(user: AdminUser) {
    this.users.set(user.id, user);
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const normalized = AdminUser.normalizeEmail(email);
    return (
      [...this.users.values()].find((user) => user.email === normalized) ?? null
    );
  }

  async findById(id: string): Promise<AdminUser | null> {
    return this.users.get(id) ?? null;
  }

  async listOrdered(): Promise<AdminUser[]> {
    return [...this.users.values()].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
  }

  async upsertByEmail(input: {
    id?: string;
    name: string;
    email: string;
    passwordHash: string;
    role: AdminUser['role'];
    active: boolean;
  }): Promise<AdminUser> {
    const existing = await this.findByEmail(input.email);
    const now = new Date();
    const user = AdminUser.restore({
      id: existing?.id ?? input.id ?? crypto.randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      active: input.active,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.users.set(user.id, user);
    return user;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<Session> {
    const session = Session.restore({
      ...input,
      createdAt: new Date(),
      revokedAt: null,
    });
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    const current = this.sessions.get(tokenHash);
    if (!current) return;
    this.sessions.set(
      tokenHash,
      Session.restore({
        id: current.id,
        userId: current.userId,
        tokenHash: current.tokenHash,
        expiresAt: current.expiresAt,
        createdAt: current.createdAt,
        revokedAt,
      }),
    );
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `hash:${password}`;
  }
}

export class FakeTokenService implements TokenService {
  private counter = 0;

  generateOpaqueToken(): string {
    this.counter += 1;
    return `token-${this.counter}-${randomBytes(8).toString('hex')}`;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
