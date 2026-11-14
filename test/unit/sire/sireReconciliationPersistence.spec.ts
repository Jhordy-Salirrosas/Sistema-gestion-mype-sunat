import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import type { ReconciliationResultEntity } from '../../../src/modules/sire/domain/entities/reconciliationResultEntity';
import {
  mapDiscrepancy,
  mapHistoryRecord,
} from '../../../src/modules/sire/infrastructure/persistence/sirePrismaMappers';
import {
  closeSireFiscalPeriod,
  findSireReconciliationForExport,
  getSireClosedHistory,
} from '../../../src/modules/sire/infrastructure/persistence/sireReconciliationQueries';
import { persistSireReconciliation } from '../../../src/modules/sire/infrastructure/persistence/sireReconciliationWriter';

const COMPANY_ID = 'company-id';

function decimal(valor: number) {
  return { toNumber: () => valor };
}

function discrepanciaPrisma(overrides: Record<string, unknown> = {}) {
  return {
    discrepancy_type: 'DIFERENCIA_IMPORTE',
    emitter_ruc: '20100070970',
    document_type: '01',
    series: 'F001',
    correlative: '123',
    sire_total_amount: decimal(100),
    local_total_amount: decimal(90),
    amount_difference: decimal(10),
    taxable_base_difference: decimal(8.47),
    igv_difference: decimal(1.53),
    duplicate_source: 'SIRE',
    ...overrides,
  };
}

function conciliacionPrisma(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conciliacion-id',
    period: '202401',
    book_type: 'RVIE_VENTAS',
    status: 'CERRADO',
    total_local_records: 10,
    total_sunat_records: 12,
    exact_matches_count: 8,
    created_at: new Date('2026-01-06T10:00:00.000Z'),
    discrepancies: [discrepanciaPrisma()],
    ...overrides,
  };
}

describe('sirePrismaMappers', () => {
  describe('mapDiscrepancy', () => {
    it('maps every field of a discrepancy', () => {
      expect(mapDiscrepancy(discrepanciaPrisma())).toEqual({
        discrepancyType: 'DIFERENCIA_IMPORTE',
        emitterRuc: '20100070970',
        documentType: '01',
        series: 'F001',
        correlative: '123',
        sireTotalAmount: 100,
        localTotalAmount: 90,
        amountDifference: 10,
        taxableBaseDifference: 8.47,
        igvDifference: 1.53,
        duplicateSource: 'SIRE',
      });
    });

    it('uses the safe defaults when the columns are null', () => {
      const resultado = mapDiscrepancy(
        discrepanciaPrisma({
          emitter_ruc: null,
          sire_total_amount: null,
          local_total_amount: null,
          amount_difference: null,
          taxable_base_difference: null,
          igv_difference: null,
          duplicate_source: null,
        }),
      );

      expect(resultado).toMatchObject({
        emitterRuc: '',
        sireTotalAmount: undefined,
        localTotalAmount: undefined,
        amountDifference: 0,
        taxableBaseDifference: undefined,
        igvDifference: undefined,
        duplicateSource: undefined,
      });
    });
  });

  describe('mapHistoryRecord', () => {
    it('maps the reconciliation and its discrepancies', () => {
      const resultado = mapHistoryRecord(conciliacionPrisma());

      expect(resultado).toMatchObject({
        id: 'conciliacion-id',
        period: '202401',
        bookType: 'RVIE',
        status: 'CERRADO',
        totalLocalRecords: 10,
        totalSireRecords: 12,
        exactMatchesCount: 8,
        createdAt: new Date('2026-01-06T10:00:00.000Z'),
      });
      expect(resultado.discrepancies).toHaveLength(1);
    });

    it('maps the purchases book to the RCE domain book', () => {
      const resultado = mapHistoryRecord(
        conciliacionPrisma({ book_type: 'RCE_COMPRAS' }),
      );

      expect(resultado.bookType).toBe('RCE');
    });
  });
});

describe('sireReconciliationQueries', () => {
  function crearPrisma() {
    return {
      sireReconciliation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService & {
      sireReconciliation: Record<string, jest.Mock>;
      $transaction: jest.Mock;
    };
  }

  describe('findSireReconciliationForExport', () => {
    it('returns the last reconciliation of the period', async () => {
      const prisma = crearPrisma();
      (prisma.sireReconciliation.findFirst as jest.Mock).mockResolvedValue(
        conciliacionPrisma(),
      );

      await expect(
        findSireReconciliationForExport(prisma, COMPANY_ID, '202401', 'RVIE'),
      ).resolves.toMatchObject({ id: 'conciliacion-id' });
      expect(prisma.sireReconciliation.findFirst).toHaveBeenCalledWith({
        where: {
          company_id: COMPANY_ID,
          period: '202401',
          book_type: 'RVIE_VENTAS',
        },
        orderBy: { created_at: 'desc' },
        include: { discrepancies: true },
      });
    });

    it('maps the purchases book to the database book', async () => {
      const prisma = crearPrisma();
      (prisma.sireReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        findSireReconciliationForExport(prisma, COMPANY_ID, '202401', 'RCE'),
      ).resolves.toBeNull();
      expect(prisma.sireReconciliation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ book_type: 'RCE_COMPRAS' }),
        }),
      );
    });
  });

  describe('getSireClosedHistory', () => {
    it('returns the page of closed reconciliations', async () => {
      const prisma = crearPrisma();
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        1,
        [conciliacionPrisma()],
      ]);

      const resultado = await getSireClosedHistory(prisma, COMPANY_ID, 0, 20);

      expect(resultado.total).toBe(1);
      expect(resultado.items).toHaveLength(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeSireFiscalPeriod', () => {
    it('closes the open reconciliations of the period', async () => {
      const prisma = crearPrisma();
      (prisma.sireReconciliation.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await closeSireFiscalPeriod(prisma, COMPANY_ID, '202401', 'RVIE');

      expect(prisma.sireReconciliation.updateMany).toHaveBeenCalledWith({
        where: {
          company_id: COMPANY_ID,
          period: '202401',
          book_type: 'RVIE_VENTAS',
          status: { not: 'CERRADO' },
        },
        data: { status: 'CERRADO', reconciled_at: expect.any(Date) },
      });
    });

    it('answers not found when the period has no reconciliation', async () => {
      const prisma = crearPrisma();
      (prisma.sireReconciliation.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (prisma.sireReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        closeSireFiscalPeriod(prisma, COMPANY_ID, '202401', 'RVIE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers conflict when the period is already closed', async () => {
      const prisma = crearPrisma();
      (prisma.sireReconciliation.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (prisma.sireReconciliation.findFirst as jest.Mock).mockResolvedValue({
        id: 'conciliacion-id',
      });

      await expect(
        closeSireFiscalPeriod(prisma, COMPANY_ID, '202401', 'RVIE'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

describe('sireReconciliationWriter', () => {
  function crearPrisma() {
    const tx = {
      sireReconciliation: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
      ),
    } as unknown as PrismaService & { $transaction: jest.Mock };
    return { prisma, tx };
  }

  const resultado: ReconciliationResultEntity = {
    companyId: COMPANY_ID,
    period: '202401',
    bookType: 'RVIE',
    totalLocalRecords: 10,
    totalSireRecords: 12,
    exactMatchesCount: 8,
    discrepanciesCount: 1,
    discrepancies: [
      {
        discrepancyType: 'DIFERENCIA_IMPORTE',
        emitterRuc: '20100070970',
        documentType: '01',
        series: 'F001',
        correlative: '123',
        sireTotalAmount: 100,
        localTotalAmount: 90,
        amountDifference: 10,
        taxableBaseDifference: 8.47,
        igvDifference: 1.53,
        duplicateSource: 'SIRE',
      },
    ],
  };

  it('stores the reconciliation and its discrepancies', async () => {
    const { prisma, tx } = crearPrisma();
    (tx.sireReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

    await persistSireReconciliation(prisma, resultado);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.sireReconciliation.create).toHaveBeenCalledWith({
      data: {
        company_id: COMPANY_ID,
        period: '202401',
        book_type: 'RVIE_VENTAS',
        total_sunat_records: 12,
        total_local_records: 10,
        exact_matches_count: 8,
        discrepancies_count: 1,
        discrepancies: {
          create: [
            {
              discrepancy_type: 'DIFERENCIA_IMPORTE',
              emitter_ruc: '20100070970',
              document_type: '01',
              series: 'F001',
              correlative: '123',
              sire_total_amount: 100,
              local_total_amount: 90,
              amount_difference: 10,
              taxable_base_difference: 8.47,
              igv_difference: 1.53,
              duplicate_source: 'SIRE',
            },
          ],
        },
      },
    });
  });

  it('stores null in the optional columns of the discrepancy', async () => {
    const { prisma, tx } = crearPrisma();
    (tx.sireReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

    await persistSireReconciliation(prisma, {
      ...resultado,
      bookType: 'RCE',
      discrepancies: [
        {
          discrepancyType: 'DIFERENCIA_IMPORTE',
          emitterRuc: '20100070970',
          documentType: '01',
          series: 'F001',
          correlative: '123',
          amountDifference: 10,
        },
      ],
    });

    const data = (tx.sireReconciliation.create as jest.Mock).mock.calls[0][0]
      .data;
    expect(data.book_type).toBe('RCE_COMPRAS');
    expect(data.discrepancies.create[0]).toMatchObject({
      sire_total_amount: null,
      local_total_amount: null,
      taxable_base_difference: null,
      igv_difference: null,
      duplicate_source: null,
    });
  });

  it('refuses to store a reconciliation of a closed period', async () => {
    const { prisma, tx } = crearPrisma();
    (tx.sireReconciliation.findFirst as jest.Mock).mockResolvedValue({
      id: 'conciliacion-id',
    });

    await expect(
      persistSireReconciliation(prisma, resultado),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.sireReconciliation.create).not.toHaveBeenCalled();
  });
});
