export interface TokenService {
  generateOpaqueToken(): string;
  hashToken(token: string): string;
}
