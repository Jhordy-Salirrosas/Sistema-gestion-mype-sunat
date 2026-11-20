import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type {
  ISireAccountingMappingRepositoryPort,
  SireAccountingMappingEntry,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';

interface SireAccountingMappingRow {
  tipoOperacion: string;
  cuentaContable: string;
}

/**
 * Adaptador del mapeo contable SIRE sobre Prisma.
 *
 * El guardado masivo usa el índice único `(companyId, tipoOperacion)` para
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
      where: { companyId },
      orderBy: { tipoOperacion: 'asc' },
      select: {
        tipoOperacion: true,
        cuentaContable: true,
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
            companyId_tipoOperacion: {
              companyId,
              tipoOperacion: mapping.tipoOperacion,
            },
          },
          create: {
            companyId,
            tipoOperacion: mapping.tipoOperacion,
            cuentaContable: mapping.cuentaContable,
          },
          update: {
            cuentaContable: mapping.cuentaContable,
          },
          select: {
            tipoOperacion: true,
            cuentaContable: true,
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
      tipoOperacion: row.tipoOperacion,
      cuentaContable: row.cuentaContable,
    };
  }
}
