import { fail, ok, type Result } from '../../../base/core/result/result';
import type { AuditService } from '../../../audit/application/services/audit.service';
import { runAtomic } from '../../../../shared/persistence/run-atomic';
import type { UnitOfWork } from '../../../../shared/persistence/unit-of-work';
import { can, type PermissionKey } from '../../core/authorization/permission-matrix';
import { AdminUser } from '../../core/entities/admin-user.entity';
import type { DomainError } from '../../../base/core/errors/domain.error';
import {
  ForbiddenError,
  InactiveUserError,
  InvalidCredentialsError,
  UnauthorizedError,
} from '../../core/errors/identity.errors';
import type { AdminUserRepository } from '../../core/repositories/admin-user.repository';
import type { PasswordHasher } from '../../core/repositories/password-hasher';
import type { SessionRepository } from '../../core/repositories/session.repository';
import type { TokenService } from '../../core/repositories/token-service';
import type {
  AdminUserDto,
  LoginRequestDto,
  LoginSuccess,
  SessionDto,
} from '../dtos/identity.dto';

export type IdentityServiceDeps = {
  users: AdminUserRepository;
  sessions: SessionRepository;
  passwords: PasswordHasher;
  tokens: TokenService;
  sessionTtlSeconds: number;
  audit: AuditService;
  unitOfWork: UnitOfWork;
  now?: () => Date;
  newId?: () => string;
};

export class IdentityService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: IdentityServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  async login(
    input: LoginRequestDto,
  ): Promise<Result<LoginSuccess, DomainError>> {
    const email = AdminUser.normalizeEmail(input.email);
    const user = await this.deps.users.findByEmail(email);

    if (!user) {
      return fail(new InvalidCredentialsError());
    }

    const valid = await this.deps.passwords.verify(
      input.password,
      user.passwordHash,
    );
    if (!valid) {
      return fail(new InvalidCredentialsError());
    }

    if (!user.active) {
      return fail(new InactiveUserError());
    }

    const rawToken = this.deps.tokens.generateOpaqueToken();
    const tokenHash = this.deps.tokens.hashToken(rawToken);
    const createdAt = this.now();
    const expiresAt = new Date(
      createdAt.getTime() + this.deps.sessionTtlSeconds * 1000,
    );

    return runAtomic(this.deps.unitOfWork, async (tx) => {
      await this.deps.sessions.create(
        {
          id: this.newId(),
          userId: user.id,
          tokenHash,
          expiresAt,
        },
        tx,
      );

      const audit = await this.deps.audit.append(
        {
          actorUserId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'identity.login_succeeded',
          targetType: 'admin_user',
          targetId: user.id,
          targetLabel: user.name,
        },
        tx,
      );
      if (!audit.ok) {
        return audit;
      }

      return ok({
        session: this.toSessionDto(user),
        rawToken,
        expiresAt,
      });
    });
  }

  async logout(rawToken: string | undefined): Promise<Result<void, DomainError>> {
    if (!rawToken) {
      return ok(undefined);
    }
    const tokenHash = this.deps.tokens.hashToken(rawToken);
    await this.deps.sessions.revokeByTokenHash(tokenHash, this.now());
    return ok(undefined);
  }

  async getSession(
    rawToken: string | undefined,
  ): Promise<Result<SessionDto, DomainError>> {
    if (!rawToken) {
      return fail(new UnauthorizedError());
    }

    const tokenHash = this.deps.tokens.hashToken(rawToken);
    const session = await this.deps.sessions.findByTokenHash(tokenHash);
    if (!session || !session.isActive(this.now())) {
      return fail(new UnauthorizedError());
    }

    const user = await this.deps.users.findById(session.userId);
    if (!user || !user.active) {
      return fail(new UnauthorizedError());
    }

    return ok(this.toSessionDto(user));
  }

  async getAuthorizedSession(
    rawToken: string | undefined,
    permission: PermissionKey,
  ): Promise<Result<SessionDto, DomainError>> {
    const sessionResult = await this.getSession(rawToken);
    if (!sessionResult.ok) {
      return sessionResult;
    }

    if (!can(sessionResult.value.role, permission)) {
      return fail(new ForbiddenError(`Missing permission: ${permission}`));
    }

    return sessionResult;
  }

  async listUsers(
    rawToken: string | undefined,
  ): Promise<Result<{ items: AdminUserDto[] }, DomainError>> {
    const sessionResult = await this.getAuthorizedSession(rawToken, 'config');
    if (!sessionResult.ok) {
      return sessionResult;
    }

    const users = await this.deps.users.listOrdered();
    return ok({
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      })),
    });
  }

  authorize(role: SessionDto['role'], permission?: PermissionKey): boolean {
    return can(role, permission);
  }

  private toSessionDto(user: AdminUser): SessionDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
