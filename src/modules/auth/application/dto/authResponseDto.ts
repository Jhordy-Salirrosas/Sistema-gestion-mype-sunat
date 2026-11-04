export interface CompanyTenantResponse {
  tenantId: string;
  ruc: string;
  razonSocial: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  companyRuc?: string;
  companyLegalName?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUserResponse;
  companies?: CompanyTenantResponse[];
  refreshToken?: string;
}
