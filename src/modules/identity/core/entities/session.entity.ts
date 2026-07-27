export type SessionProps = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
};

export class Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;

  private constructor(props: SessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
    this.revokedAt = props.revokedAt;
  }

  static restore(props: SessionProps): Session {
    return new Session(props);
  }

  isActive(now: Date = new Date()): boolean {
    if (this.revokedAt) return false;
    return this.expiresAt.getTime() > now.getTime();
  }
}
