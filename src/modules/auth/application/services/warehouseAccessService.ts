import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';

@Injectable()
export class WarehouseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async allowedCodes(user: Pick<TokenPayload, 'sub' | 'companyId' | 'role'>): Promise<string[]> {
    if (user.role === 'ADMIN') {
      const todas = await this.prisma.inventoryWarehouse.findMany({
        where: { company_id: user.companyId, is_active: true },
        select: { warehouse_code: true },
        orderBy: { warehouse_code: 'asc' },
      });
      return todas.map((w) => w.warehouse_code);
    }
    const filas = await this.prisma.userWarehouse.findMany({
      where: { user_id: user.sub, warehouse: { company_id: user.companyId, is_active: true } },
      select: { warehouse: { select: { warehouse_code: true } } },
      orderBy: { warehouse: { warehouse_code: 'asc' } },
    });
    return filas.map((f) => f.warehouse.warehouse_code);
  }

  async listAllowed(user: Pick<TokenPayload, 'sub' | 'companyId' | 'role'>) {
    const codes = await this.allowedCodes(user);
    if (codes.length === 0) return [];
    return this.prisma.inventoryWarehouse.findMany({
      where: { company_id: user.companyId, is_active: true, warehouse_code: { in: codes } },
      select: { warehouse_code: true, description: true, sunat_establishment_code: true },
      orderBy: { warehouse_code: 'asc' },
    });
  }

  async assertWarehouse(user: Pick<TokenPayload, 'sub' | 'companyId' | 'role'>, code: string) {
    const codigos = await this.allowedCodes(user);
    if (!codigos.includes(code)) {
      throw new ForbiddenException(`No tiene acceso al almacén ${code}.`);
    }
  }

  async listUsers(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { company_id: companyId },
      select: {
        id: true, email: true, full_name: true, role: true, is_active: true,
        warehouse_access: { select: { warehouse: { select: { warehouse_code: true } } } },
      },
      orderBy: { full_name: 'asc' },
    });
    return users.map((u) => ({
      id: u.id, email: u.email, fullName: u.full_name, role: u.role, isActive: u.is_active,
      warehouseCodes: u.warehouse_access.map((a) => a.warehouse.warehouse_code),
    }));
  }

  async setUserWarehouses(companyId: string, userId: string, codes: string[]) {
    const usuario = await this.prisma.user.findFirst({ where: { id: userId, company_id: companyId }, select: { id: true } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    const almacenes = await this.prisma.inventoryWarehouse.findMany({
      where: { company_id: companyId, is_active: true, warehouse_code: { in: [...new Set(codes)] } },
      select: { id: true, warehouse_code: true },
    });
    if (almacenes.length !== new Set(codes).size) throw new NotFoundException('Uno de los almacenes no existe o está inactivo.');
    await this.prisma.$transaction(async (tx) => {
      await tx.userWarehouse.deleteMany({ where: { user_id: userId } });
      if (almacenes.length) await tx.userWarehouse.createMany({ data: almacenes.map((w) => ({ user_id: userId, warehouse_id: w.id })) });
    });
    return { userId, warehouseCodes: almacenes.map((w) => w.warehouse_code) };
  }
}
