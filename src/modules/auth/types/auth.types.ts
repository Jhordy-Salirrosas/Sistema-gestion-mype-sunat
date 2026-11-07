/**
 * Tipos oficiales para el módulo AUTH & IAM
 * Alineado con especificacionAuth.md y fasesAuth.md
 */

export type Role =
  | 'ADMIN'
  | 'CONTADOR'
  | 'OPERADOR_FACTURACION'
  | 'OPERADOR_ADUANAS'
  | 'AUDITOR'
  // Compatibilidad hacia atrás
  | 'ACCOUNTANT'
  | 'OPERATOR';

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  name?: string; // compatibilidad con vistas previas
  role: Role;
  isActive?: boolean;
  companyRuc?: string;
  companyLegalName?: string;
  companyTradeName?: string;
}

// Compatibilidad hacia atrás con componentes previos
export type UserProfile = AuthUser;

export interface CompanyTenant {
  tenantId: string;
  ruc: string;
  razonSocial: string;
  regimen?: 'MYPE_TRIBUTARIO' | 'GENERAL' | 'ESPECIAL' | 'RUS';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type LoginCredentials = LoginPayload;

export interface RegisterPayload {
  ruc: string;
  legalName: string;
  tradeName?: string;
  solUser: string;
  solPassword: string;
  fullName: string;
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfilePayload {
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  token?: string; // compatibilidad hacia atrás
  tokenType?: string;
  expiresIn?: number;
  user: AuthUser;
  companies?: CompanyTenant[];
}

export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  company: {
    id: string;
    ruc: string;
    legalName: string;
    tradeName?: string | null;
    solUser?: string;
    isActive?: boolean;
  };
}

export interface ApiActionResponse {
  success: boolean;
  message: string;
}
