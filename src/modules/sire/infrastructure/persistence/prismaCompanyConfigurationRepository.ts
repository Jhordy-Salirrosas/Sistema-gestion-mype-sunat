import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type {
  CompanyConfigurationChanges,
  CompanyConfigurationData,
  ICompanyConfigurationRepositoryPort,
} from '../../domain/ports/companyConfigurationRepositoryPort';

/**
 * Adaptador de las variables globales de la empresa sobre Prisma.
 *
 * El RUC vive en `Company`; el nombre y las series viven en
 * `CompanyConfiguration`, que se crea en el primer guardado.
 */
@Injectable()
export class PrismaCompanyConfigurationRepository
  implements ICompanyConfigurationRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findByCompanyId(
    companyId: string,
  ): Promise<CompanyConfigurationData | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true },
    });

    if (!company) {
      return null;
    }

    const configuration = await this.prisma.companyConfiguration.findUnique({
      where: { company_id: companyId },
      select: {
        business_name: true,
        series: true,
      },
    });

    return {
      ruc: company.ruc,
      businessName: configuration?.business_name ?? null,
      series: configuration?.series ?? [],
    };
  }

  async update(
    companyId: string,
    changes: CompanyConfigurationChanges,
  ): Promise<CompanyConfigurationData | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true },
    });

    if (!company) {
      return null;
    }

    const row = await this.prisma.companyConfiguration.upsert({
      where: { company_id: companyId },
      create: {
        company_id: companyId,
        business_name: changes.businessName ?? null,
        series: changes.series ?? [],
      },
      update: {
        ...(changes.businessName !== undefined
          ? { business_name: changes.businessName }
          : {}),
        ...(changes.series !== undefined ? { series: changes.series } : {}),
      },
      select: {
        business_name: true,
        series: true,
      },
    });

    return {
      ruc: company.ruc,
      businessName: row.business_name,
      series: row.series,
    };
  }
}
