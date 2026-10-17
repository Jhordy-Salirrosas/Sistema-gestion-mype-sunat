export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt?: Date;
}

export class RefreshTokenEntity {
  constructor(private readonly props: RefreshTokenProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get isRevoked(): boolean {
    return this.props.isRevoked;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  isValid(now: Date = new Date()): boolean {
    return !this.props.isRevoked && !this.isExpired(now);
  }

  revoke(): RefreshTokenEntity {
    return new RefreshTokenEntity({
      ...this.props,
      isRevoked: true,
    });
  }
}
