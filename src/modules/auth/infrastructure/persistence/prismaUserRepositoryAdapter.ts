import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { UserEntity, type UserRole } from '../../domain/entities/userEntity';
import type {
  UserAuthRecord,
  UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';

@Injectable()
export class PrismaUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    const raw = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!raw) return null;

    const user = new UserEntity({
      id: raw.id,
      companyId: raw.company_id,
      email: raw.email,
      fullName: raw.full_name,
      role: raw.role as UserRole,
      isActive: raw.is_active,
    });

    return {
      user,
      passwordHash: raw.password_hash,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!raw) return null;

    return new UserEntity({
      id: raw.id,
      companyId: raw.company_id,
      email: raw.email,
      fullName: raw.full_name,
      role: raw.role as UserRole,
      isActive: raw.is_active,
    });
  }
}
