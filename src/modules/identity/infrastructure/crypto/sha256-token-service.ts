import { createHash, randomBytes } from 'node:crypto';
import type { TokenService } from '../../core/repositories/token-service';

export class Sha256TokenService implements TokenService {
  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
