import { eq } from 'drizzle-orm';
import type { Session } from '../../core/entities/session.entity';
import type { SessionRepository } from '../../core/repositories/session.repository';
import type { Database } from '../../../../main/persistence/database';
import { resolveDb } from '../../../../main/persistence/resolve-db';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import { SessionMapper } from '../mappers/session.mapper';
import { identitySessions } from '../persistence/identity-sessions.schema';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(
    input: {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: TransactionContext,
  ): Promise<Session> {
    const db = resolveDb(this.db, tx);
    const rows = await db
      .insert(identitySessions)
      .values({
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('Failed to insert session');
    return SessionMapper.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(identitySessions)
      .where(eq(identitySessions.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    return row ? SessionMapper.toDomain(row) : null;
  }

  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(identitySessions)
      .set({ revokedAt })
      .where(eq(identitySessions.tokenHash, tokenHash));
  }
}
