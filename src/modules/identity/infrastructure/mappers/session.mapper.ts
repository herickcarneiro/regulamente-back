import { Session } from '../../core/entities/session.entity';
import type { IdentitySessionRow } from '../persistence/identity-sessions.schema';

export const SessionMapper = {
  toDomain(row: IdentitySessionRow): Session {
    return Session.restore({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    });
  },
};
