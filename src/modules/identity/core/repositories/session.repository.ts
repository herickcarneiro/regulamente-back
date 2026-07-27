import type { Session } from '../entities/session.entity';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';

export interface SessionRepository {
  create(
    input: {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: TransactionContext,
  ): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
}
