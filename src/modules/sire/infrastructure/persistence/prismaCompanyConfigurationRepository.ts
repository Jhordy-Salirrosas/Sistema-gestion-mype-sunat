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
 * El RUC y los datos fiscales base viven en `Company`; los valores editables
 * viven en `CompanyConfiguration`, que se crea en el primer guardado.
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
      select: {
        ruc: true,
        legal_name: true,
        trade_name: true,
        domicilio_fiscal: true,
        ubigeo_fiscal: true,
      },
    });

    if (!company) {
      return null;
    }

    const configuration = await this.prisma.companyConfiguration.findUnique({
      where: { company_id: companyId },
      select: {
        business_name: true,
        trade_name: true,
        direccion: true,
        estado: true,
        condicion: true,
        ubigeo: true,
        es_agente_retencion: true,
        series: true,
      },
    });

    return {
      ruc: company.ruc,
      businessName: configuration?.business_name ?? company.legal_name,
      tradeName: configuration?.trade_name ?? company.trade_name,
      direccion: configuration?.direccion ?? company.domicilio_fiscal,
      estado: configuration?.estado ?? null,
      condicion: configuration?.condicion ?? null,
      ubigeo: configuration?.ubigeo ?? company.ubigeo_fiscal,
      esAgenteRetencion: configuration?.es_agente_retencion ?? null,
      series: configuration?.series ?? [],
    };
  }

  async update(
    companyId: string,
    changes: CompanyConfigurationChanges,
  ): Promise<CompanyConfigurationData | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        ruc: true,
        legal_name: true,
        trade_name: true,
        domicilio_fiscal: true,
        ubigeo_fiscal: true,
      },
    });

    if (!company) {
      return null;
    }

    const row = await this.prisma.companyConfiguration.upsert({
      where: { company_id: companyId },
      create: {
        company_id: companyId,
        business_name: changes.businessName ?? null,
        trade_name: changes.tradeName ?? null,
        direccion: changes.direccion ?? null,
        estado: changes.estado ?? null,
        condicion: changes.condicion ?? null,
        ubigeo: changes.ubigeo ?? null,
        es_agente_retencion: changes.esAgenteRetencion ?? null,
        series: changes.series ?? [],
      },
      update: {
        ...(changes.businessName !== undefined
          ? { business_name: changes.businessName }
          : {}),
        ...(changes.tradeName !== undefined
          ? { trade_name: changes.tradeName }
          : {}),
        ...(changes.direccion !== undefined
          ? { direccion: changes.direccion }
          : {}),
        ...(changes.estado !== undefined ? { estado: changes.estado } : {}),
        ...(changes.condicion !== undefined
          ? { condicion: changes.condicion }
          : {}),
        ...(changes.ubigeo !== undefined ? { ubigeo: changes.ubigeo } : {}),
        ...(changes.esAgenteRetencion !== undefined
          ? { es_agente_retencion: changes.esAgenteRetencion }
          : {}),
        ...(changes.series !== undefined ? { series: changes.series } : {}),
      },
      select: {
        business_name: true,
        trade_name: true,
        direccion: true,
        estado: true,
        condicion: true,
        ubigeo: true,
        es_agente_retencion: true,
        series: true,
      },
    });

    return {
      ruc: company.ruc,
      businessName: row.business_name ?? company.legal_name,
      tradeName: row.trade_name ?? company.trade_name,
      direccion: row.direccion ?? company.domicilio_fiscal,
      estado: row.estado,
      condicion: row.condicion,
      ubigeo: row.ubigeo ?? company.ubigeo_fiscal,
      esAgenteRetencion: row.es_agente_retencion,
      series: row.series,
    };
  }
}
