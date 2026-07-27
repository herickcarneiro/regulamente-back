import type { PasswordHasher } from '../../core/repositories/password-hasher';

export class BunPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: 'argon2id',
    });
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return Bun.password.verify(password, passwordHash);
  }
}
