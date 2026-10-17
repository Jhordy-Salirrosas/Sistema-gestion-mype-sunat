export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
}

export interface AuthResponseDto {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUserResponse;
  refreshToken?: string;
}
