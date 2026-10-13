export interface TokenPayload {
  sub: string;
  email: string;
  companyId: string;
  role: string;
}

export const TOKEN_SERVICE_PORT = Symbol('TOKEN_SERVICE_PORT');

export interface TokenServicePort {
  signToken(payload: TokenPayload, expiresInSeconds?: number): string;
  verifyToken(token: string): TokenPayload | null;
}
