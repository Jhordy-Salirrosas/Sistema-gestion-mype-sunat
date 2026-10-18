import { UserEntity } from '../entities/userEntity';
import { CompanyEntity } from '../entities/companyEntity';
import { RefreshTokenEntity } from '../entities/refreshTokenEntity';

export interface UserAuthRecord {
  user: UserEntity;
  passwordHash: string;
}

export interface CreateUserWithCompanyParams {
  user: UserEntity;
  company: CompanyEntity;
  passwordHash: string;
  initialRefreshToken?: {
    tokenHash: string;
    expiresAt: Date;
  };
}

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');

export interface IUserRepositoryPort {
  findByEmail(email: string): Promise<UserAuthRecord | null>;
  findById(id: string, companyId?: string): Promise<UserEntity | null>;
  findByRuc(ruc: string): Promise<CompanyEntity | null>;
  findCompanyById(companyId: string): Promise<CompanyEntity | null>;
  createUserWithCompany(
    params: CreateUserWithCompanyParams,
  ): Promise<{ user: UserEntity; company: CompanyEntity }>;
  saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenEntity>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenEntity | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  updateProfile(userId: string, fullName: string): Promise<UserEntity>;
}

export type UserRepositoryPort = IUserRepositoryPort;
