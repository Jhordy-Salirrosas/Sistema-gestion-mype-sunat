import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IInventoryObligationRepositoryPort,
  InventoryObligationDecisionRecord,
} from '../../domain/ports/IInventoryObligationRepositoryPort';

@Injectable()
export class PrismaInventoryObligationRepository implements IInventoryObligationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async saveDecision(
    decision: InventoryObligationDecisionRecord,
  ): Promise<InventoryObligationDecisionRecord> {
    const row = await this.prisma.inventoryBookObligationDecision.upsert({
      where: {
        company_id_fiscal_year: {
          company_id: decision.companyId,
          fiscal_year: decision.fiscalYear,
        },
      },
      create: {
        company_id: decision.companyId,
        fiscal_year: decision.fiscalYear,
        annual_revenue_uit: decision.annualRevenueUit,
        tax_regime: decision.taxRegime,
        ple_12_1_status: decision.ple12_1Status,
        ple_13_1_status: decision.ple13_1Status,
        legal_basis_notes: decision.legalBasisNotes,
      },
      update: {
        annual_revenue_uit: decision.annualRevenueUit,
        tax_regime: decision.taxRegime,
        ple_12_1_status: decision.ple12_1Status,
        ple_13_1_status: decision.ple13_1Status,
        legal_basis_notes: decision.legalBasisNotes,
        evaluated_at: new Date(),
      },
    });

    return {
      id: row.id,
      companyId: row.company_id,
      fiscalYear: row.fiscal_year,
      annualRevenueUit: Number(row.annual_revenue_uit),
      taxRegime: row.tax_regime,
      ple12_1Status: row.ple_12_1_status as any,
      ple13_1Status: row.ple_13_1_status as any,
      legalBasisNotes: row.legal_basis_notes,
      evaluatedAt: row.evaluated_at,
    };
  }

  async findByFiscalYear(
    companyId: string,
    fiscalYear: number,
  ): Promise<InventoryObligationDecisionRecord | null> {
    const row = await this.prisma.inventoryBookObligationDecision.findFirst({
      where: { company_id: companyId, fiscal_year: fiscalYear },
    });

    if (!row) return null;

    return {
      id: row.id,
      companyId: row.company_id,
      fiscalYear: row.fiscal_year,
      annualRevenueUit: Number(row.annual_revenue_uit),
      taxRegime: row.tax_regime,
      ple12_1Status: row.ple_12_1_status as any,
      ple13_1Status: row.ple_13_1_status as any,
      legalBasisNotes: row.legal_basis_notes,
      evaluatedAt: row.evaluated_at,
    };
  }
}

