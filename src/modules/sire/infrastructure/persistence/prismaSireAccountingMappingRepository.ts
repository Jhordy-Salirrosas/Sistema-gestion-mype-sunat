import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type {
  ISireAccountingMappingRepositoryPort,
  SireAccountingMappingEntry,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';

interface SireAccountingMappingRow {
  tipo_operacion: string;
  cuenta_contable: string;
}

/**
 * Adaptador del mapeo contable SIRE sobre Prisma.
 *
 * El guardado masivo usa el índice único `(company_id, tipo_operacion)` para
 * hacer upsert de cada concepto en una sola transacción.
 */
@Injectable()
export class PrismaSireAccountingMappingRepository
  implements ISireAccountingMappingRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
  ): Promise<SireAccountingMappingEntry[] | null> {
    const exists = await this.companyExists(companyId);
    if (!exists) {
      return null;
    }

    const rows = await this.prisma.sireAccountingMapping.findMany({
      where: { company_id: companyId },
      orderBy: { tipo_operacion: 'asc' },
      select: {
        tipo_operacion: true,
        cuenta_contable: true,
      },
    });

    return rows.map((row) => this.toEntry(row));
  }

  async upsertMany(
    companyId: string,
    mappings: SireAccountingMappingEntry[],
  ): Promise<SireAccountingMappingEntry[] | null> {
    const exists = await this.companyExists(companyId);
    if (!exists) {
      return null;
    }

    const rows = await this.prisma.$transaction(
      mappings.map((mapping) =>
        this.prisma.sireAccountingMapping.upsert({
          where: {
            company_id_tipo_operacion: {
              company_id: companyId,
              tipo_operacion: mapping.tipoOperacion,
            },
          },
          create: {
            company_id: companyId,
            tipo_operacion: mapping.tipoOperacion,
            cuenta_contable: mapping.cuentaContable,
          },
          update: {
            cuenta_contable: mapping.cuentaContable,
          },
          select: {
            tipo_operacion: true,
            cuenta_contable: true,
          },
        }),
      ),
    );

    return rows.map((row) => this.toEntry(row));
  }

  private async companyExists(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    return company !== null;
  }

  private toEntry(row: SireAccountingMappingRow): SireAccountingMappingEntry {
    return {
      tipoOperacion: row.tipo_operacion,
      cuentaContable: row.cuenta_contable,
    };
  }
}
