import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { HASHER_PORT, type HasherPort } from '../../domain/ports/hasherPort';
import { PasswordStrengthRule } from '../../domain/rules/passwordStrengthRule';
import type { CreateUserDto } from '../dto/createUserDto';

@Injectable()
export class CreateUserService {
  constructor(private readonly prisma: PrismaService, @Inject(HASHER_PORT) private readonly hasher: HasherPort) {}

  async create(companyId: string, dto: CreateUserDto) {
    try { PasswordStrengthRule.validate(dto.password); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'La contraseña no cumple los requisitos de seguridad.'); }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    if (existing) throw new ConflictException('El correo electrónico ya está registrado.');
    const passwordHash = await this.hasher.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { company_id: companyId, full_name: dto.name.trim(), email, password_hash: passwordHash, role: dto.role, is_active: true },
        select: { id: true, company_id: true, email: true, full_name: true, role: true, is_active: true },
      });
      return { id: user.id, companyId: user.company_id, email: user.email, fullName: user.full_name, role: user.role, isActive: user.is_active };
    } catch (error) {
      // La unicidad global en PostgreSQL decide también ante altas concurrentes.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('El correo electrónico ya está registrado.');
      }
      throw error;
    }
  }
}
