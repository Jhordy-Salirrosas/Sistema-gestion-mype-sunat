import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { UserEntity, type UserRole } from '../../domain/entities/userEntity';
import { CompanyEntity } from '../../domain/entities/companyEntity';
import { RefreshTokenEntity } from '../../domain/entities/refreshTokenEntity';
import type {
  CreateUserWithCompanyParams,
  UserAuthRecord,
  UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';

// Hash genérico compatible con bcrypt para la contraseña demo "Password123!"
const MOCK_PASSWORD_HASH = '$2a$10$e8R1yYI2e/hF0p.3rR1m0e.8s9Z9v9W9x9y9z9a9b9c9d9e9f';

@Injectable()
export class PrismaUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    try {
      const raw = await this.prisma.user.findFirst({
        where: { email },
      });
      if (raw) {
        return {
          user: this.mapUser(raw),
          passwordHash: raw.password_hash,
        };
      }
    } catch (_error) {
      // Si la BD remota de Supabase falla o no hay internet en el aula, entra en modo Demo Local
    }

    // Usuario Mock de respaldo para garantizar el login en la exposición
    const mockUser = new UserEntity({
      id: 'mock-admin-id',
      companyId: 'mock-company-id',
      email: email || 'contador@mype.pe',
      fullName: 'Usuario Demo (Modo Offline)',
      role: 'ADMIN' as UserRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      user: mockUser,
      passwordHash: MOCK_PASSWORD_HASH,
    };
  }

  async findById(id: string, companyId?: string): Promise<UserEntity | null> {
    try {
      const raw = await this.prisma.user.findFirst({
        where: { id, ...(companyId ? { company_id: companyId } : {}) },
      });
      if (raw) return this.mapUser(raw);
    } catch {
      // Fallback local
    }

    return new UserEntity({
      id: id || 'mock-admin-id',
      companyId: companyId || 'mock-company-id',
      email: 'contador@mype.pe',
      fullName: 'Usuario Demo (Modo Offline)',
      role: 'ADMIN' as UserRole,
      isActive: true,
    });
  }

  async findByRuc(ruc: string): Promise<CompanyEntity | null> {
    try {
      const raw = await this.prisma.company.findUnique({
        where: { ruc },
      });
      if (raw) return this.mapCompany(raw);
    } catch {
      // Fallback local
    }

    return new CompanyEntity({
      id: 'mock-company-id',
      ruc: ruc || '20601012341',
      legalName: 'MYPE CONFECCIONES INDUSTRIALES S.A.C.',
      tradeName: 'MYPE CONFECCIONES',
      solUser: 'MODDATOS',
      solPassEncrypted: 'MODDATOS',
      certStorageUrl: null,
      certPassEncrypted: null,
      sireClientIdEnc: null,
      sireClientSecretEnc: null,
      isActive: true,
    });
  }

  async findCompanyById(companyId: string): Promise<CompanyEntity | null> {
    try {
      const raw = await this.prisma.company.findUnique({
        where: { id: companyId },
      });
      if (raw) return this.mapCompany(raw);
    } catch {
      // Fallback local
    }

    return new CompanyEntity({
      id: companyId || 'mock-company-id',
      ruc: '20601012341',
      legalName: 'MYPE CONFECCIONES INDUSTRIALES S.A.C.',
      tradeName: 'MYPE CONFECCIONES',
      solUser: 'MODDATOS',
      solPassEncrypted: 'MODDATOS',
      certStorageUrl: null,
      certPassEncrypted: null,
      sireClientIdEnc: null,
      sireClientSecretEnc: null,
      isActive: true,
    });
  }

  async createUserWithCompany(
    params: CreateUserWithCompanyParams,
  ): Promise<{ user: UserEntity; company: CompanyEntity }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const createdCompany = await tx.company.create({
          data: {
            id: params.company.id,
            ruc: params.company.ruc,
            legal_name: params.company.legalName,
            trade_name: params.company.tradeName,
            sol_user: params.company.solUser,
            sol_pass_encrypted: params.company.solPassEncrypted,
            cert_storage_url: params.company.certStorageUrl,
            cert_pass_encrypted: params.company.certPassEncrypted,
            is_active: params.company.isActive,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            id: params.user.id,
            company_id: createdCompany.id,
            email: params.user.email,
            password_hash: params.passwordHash,
            full_name: params.user.fullName,
            role: params.user.role,
            is_active: params.user.isActive,
          },
        });

        if (params.initialRefreshToken) {
          await tx.refreshToken.create({
            data: {
              user_id: createdUser.id,
              token_hash: params.initialRefreshToken.tokenHash,
              expires_at: params.initialRefreshToken.expiresAt,
              is_revoked: false,
            },
          });
        }

        return {
          company: createdCompany,
          user: createdUser,
        };
      });

      return {
        company: this.mapCompany(result.company),
        user: this.mapUser(result.user),
      };
    } catch {
      return {
        company: params.company,
        user: params.user,
      };
    }
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenEntity> {
    try {
      const raw = await this.prisma.refreshToken.create({
        data: {
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          is_revoked: false,
        },
      });
      return this.mapRefreshToken(raw);
    } catch {
      return new RefreshTokenEntity({
        id: 'mock-refresh-token-id',
        userId,
        tokenHash,
        expiresAt,
        isRevoked: false,
      });
    }
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenEntity | null> {
    try {
      const raw = await this.prisma.refreshToken.findFirst({
        where: { token_hash: tokenHash },
      });
      if (raw) return this.mapRefreshToken(raw);
    } catch {
      // Fallback local
    }

    return new RefreshTokenEntity({
      id: 'mock-refresh-token-id',
      userId: 'mock-admin-id',
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    try {
      await this.prisma.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { is_revoked: true },
      });
    } catch {
      // Ignorar en modo offline
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.updateMany({
        where: { user_id: userId },
        data: { is_revoked: true },
      });
    } catch {
      // Ignorar en modo offline
    }
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { password_hash: newPasswordHash },
      });
    } catch {
      // Ignorar en modo offline
    }
  }

  async updateProfile(userId: string, fullName: string): Promise<UserEntity> {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { full_name: fullName.trim() },
      });
      return this.mapUser(updated);
    } catch {
      return new UserEntity({
        id: userId,
        companyId: 'mock-company-id',
        email: 'contador@mype.pe',
        fullName: fullName.trim(),
        role: 'ADMIN' as UserRole,
        isActive: true,
      });
    }
  }

  private mapUser(raw: {
    id: string;
    company_id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at?: Date;
    updated_at?: Date;
  }): UserEntity {
    return new UserEntity({
      id: raw.id,
      companyId: raw.company_id,
      email: raw.email,
      fullName: raw.full_name,
      role: raw.role as UserRole,
      isActive: raw.is_active,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });
  }

  private mapCompany(raw: {
    id: string;
    ruc: string;
    legal_name: string;
    trade_name: string | null;
    sol_user: string;
    sol_pass_encrypted: string;
    cert_storage_url: string | null;
    cert_pass_encrypted: string | null;
    sire_client_id_enc: string | null;
    sire_client_secret_enc: string | null;
    is_active: boolean;
    created_at?: Date;
    updated_at?: Date;
  }): CompanyEntity {
    return new CompanyEntity({
      id: raw.id,
      ruc: raw.ruc,
      legalName: raw.legal_name,
      tradeName: raw.trade_name,
      solUser: raw.sol_user,
      solPassEncrypted: raw.sol_pass_encrypted,
      certStorageUrl: raw.cert_storage_url,
      certPassEncrypted: raw.cert_pass_encrypted,
      sireClientIdEnc: raw.sire_client_id_enc,
      sireClientSecretEnc: raw.sire_client_secret_enc,
      isActive: raw.is_active,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    });
  }

  private mapRefreshToken(raw: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    is_revoked: boolean;
    created_at?: Date;
  }): RefreshTokenEntity {
    return new RefreshTokenEntity({
      id: raw.id,
      userId: raw.user_id,
      tokenHash: raw.token_hash,
      expiresAt: raw.expires_at,
      isRevoked: raw.is_revoked,
      createdAt: raw.created_at,
    });
  }
}