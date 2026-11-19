import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { CompanyListItem } from '../dto/companyConfigurationDto';

/**
 * Empresas disponibles para el selector Multi-RUC.
 *
 * Solo se exponen empresas activas y únicamente a un ADMIN (la restricción se
 * aplica en el controlador con RolesGuard). El frontend usa el `id` como
 * `companyId` para consultar credenciales, mapeo y datos fiscales.
 */
@Injectable()
export class ListCompaniesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<CompanyListItem[]> {
    const companies = await this.prisma.company.findMany({
      where: { is_active: true },
      orderBy: [{ legal_name: 'asc' }, { ruc: 'asc' }],
      select: {
        id: true,
        ruc: true,
        legal_name: true,
        trade_name: true,
        is_active: true,
      },
    });

    return companies.map((company) => ({
      id: company.id,
      ruc: company.ruc,
      razonSocial: company.legal_name,
      nombreComercial: company.trade_name ?? null,
      activa: company.is_active,
    }));
  }
}
