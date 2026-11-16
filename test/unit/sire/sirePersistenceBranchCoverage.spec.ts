import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import { PrismaSireRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireRepository';
import { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
import { SireDashboardMetricsRepository } from '../../../src/modules/sire/infrastructure/persistence/sireDashboardMetricsRepository';
import {
  closeSireFiscalPeriod,
  findSireReconciliationForExport,
  getSireClosedHistory,
} from '../../../src/modules/sire/infrastructure/persistence/sireReconciliationQueries';
import { persistSireReconciliation } from '../../../src/modules/sire/infrastructure/persistence/sireReconciliationWriter';

jest.mock(
  '../../../src/modules/sire/infrastructure/persistence/sireReconciliationQueries',
  () => ({
    closeSireFiscalPeriod: jest.fn(),
    findSireReconciliationForExport: jest.fn(),
    getSireClosedHistory: jest.fn(),
  }),
);

jest.mock(
  '../../../src/modules/sire/infrastructure/persistence/sireReconciliationWriter',
  () => ({
    persistSireReconciliation: jest.fn(),
  }),
);

const COMPANY_ID = 'company-a';

const propuesta = {
  companyId: COMPANY_ID,
  period: '202610',
  bookType: 'RCE' as const,
  carSunat: 'CAR-1',
  emitterRuc: '20100070970',
  documentType: '01',
  series: 'F001',
  correlative: '1',
  issueDate: new Date('2026-10-01T00:00:00.000Z'),
  taxableBase: 100,
  igvAmount: 18,
  totalAmount: 118,
};

const filaAlmacenada = {
  id: 'proposal-1',
  company_id: COMPANY_ID,
  period: '202610',
  book_type: 'RCE_COMPRAS',
  car_sunat: 'CAR-1',
  issue_date: new Date('2026-10-01T00:00:00.000Z'),
  emitter_ruc: '20100070970',
  document_type: '01',
  series: 'F001',
  correlative: '1',
  taxable_base: { toNumber: () => 100 },
  igv_amount: { toNumber: () => 18 },
  total_amount: { toNumber: () => 118 },
  origin: 'SUNAT',
};

function crearPrismaSire() {
  return {
    sirePeriod: {
      upsert: jest
        .fn()
        .mockResolvedValue({ id: 'period-1', state: 'PROPUESTA' }),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sireProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'proposal-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sireReconciliation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sireReportUpload: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
}

function crearPrismaMenu() {
  return {
    sireImportacion: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    sireConciliacion: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    sireReporte: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $queryRaw: jest.fn(),
  } as unknown as PrismaService & {
    sireImportacion: Record<string, jest.Mock>;
    sireConciliacion: Record<string, jest.Mock>;
    sireReporte: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
  };
}

describe('PrismaSireRepository uncovered branches', () => {
  let prisma: ReturnType<typeof crearPrismaSire>;
  let repository: PrismaSireRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = crearPrismaSire();
    repository = new PrismaSireRepository(prisma as never);
  });

  it('stores an RVIE period with the ventas book type', async () => {
    await repository.upsertPeriod(COMPANY_ID, '202610', 'RVIE');

    expect(prisma.sirePeriod.upsert).toHaveBeenCalledWith({
      where: {
        company_id_period_book_type: {
          company_id: COMPANY_ID,
          period: '202610',
          book_type: 'RVIE_VENTAS',
        },
      },
      create: {
        company_id: COMPANY_ID,
        period: '202610',
        book_type: 'RVIE_VENTAS',
      },
      update: {},
      select: { id: true, state: true },
    });
  });

  it('reads an RCE period and returns null when the period does not exist', async () => {
    prisma.sirePeriod.findUnique
      .mockResolvedValueOnce({
        id: 'period-1',
        state: 'PROPUESTA',
        ticket: null,
        ticket_operation: null,
      })
      .mockResolvedValueOnce(null);

    await expect(
      repository.getPeriod(COMPANY_ID, '202610', 'RCE'),
    ).resolves.toEqual({
      id: 'period-1',
      state: 'PROPUESTA',
      ticket: null,
      ticketOperation: null,
    });
    expect(prisma.sirePeriod.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          company_id_period_book_type: {
            company_id: COMPANY_ID,
            period: '202610',
            book_type: 'RCE_COMPRAS',
          },
        },
      }),
    );

    await expect(
      repository.getPeriod(COMPANY_ID, '202611', 'RCE'),
    ).resolves.toBeNull();
  });

  it('persists the proposals of an RVIE period', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const findMany = jest.fn().mockResolvedValue([]);
    const update = jest.fn();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          sirePeriod: { update },
          sireProposal: { findMany, createMany },
        }),
    );

    await repository.saveSunatProposal(COMPANY_ID, '202610', 'RVIE', [
      { ...propuesta, bookType: 'RVIE' },
    ]);

    expect(prisma.sirePeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
      }),
    );
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ book_type: 'RVIE_VENTAS' })],
    });
  });

  it('rejects the exclusion of a proposal that does not exist', async () => {
    prisma.sireProposal.findFirst.mockResolvedValue(null);

    await expect(
      repository.excludeSunatProposal(COMPANY_ID, 'missing', 'user-a'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      repository.getProposal(COMPANY_ID, 'missing'),
    ).resolves.toBeNull();
    expect(prisma.sireProposal.update).not.toHaveBeenCalled();
  });

  it('resolves the period state as null when the proposal has no period record', async () => {
    prisma.sireProposal.findFirst.mockResolvedValue({
      id: 'proposal-1',
      origin: 'SUNAT',
      period_id: 'period-1',
      period_record: null,
    });

    await expect(
      repository.getProposal(COMPANY_ID, 'proposal-1'),
    ).resolves.toEqual({
      id: 'proposal-1',
      origin: 'SUNAT',
      periodId: 'period-1',
      periodState: null,
    });
  });

  it('lists the proposals of an RCE period', async () => {
    prisma.sireProposal.findMany.mockResolvedValue([filaAlmacenada]);

    await expect(
      repository.getPeriodProposals(COMPANY_ID, '202610', 'RCE'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'proposal-1',
        bookType: 'RCE',
        totalAmount: 118,
        origin: 'SUNAT',
      }),
    ]);
    expect(prisma.sireProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RCE_COMPRAS' }),
      }),
    );
  });

  it('updates the ticket of an RVIE period', async () => {
    await repository.setPeriodTicket(
      COMPANY_ID,
      '202610',
      'RVIE',
      'PROCESANDO_GENERACION',
      'T-1',
      'GENERACION',
    );

    expect(prisma.sirePeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
      }),
    );
  });

  it('updates the state of an RVIE period', async () => {
    await repository.setPeriodState(
      COMPANY_ID,
      '202610',
      'RVIE',
      'PROCESANDO_GENERACION',
      'falló',
    );

    expect(prisma.sirePeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
      }),
    );
  });

  it('rejects a batch import when the fiscal period is already closed', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          sireProposal: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn(),
          },
          sireReconciliation: {
            findFirst: jest.fn().mockResolvedValue({ id: 'recon-1' }),
          },
        }),
    );

    await expect(
      repository.saveBatchProposals([propuesta]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a proposal that does not belong to the requested scope', async () => {
    await expect(
      repository.saveSunatProposal(COMPANY_ID, '202610', 'RCE', [
        { ...propuesta, companyId: 'company-b' },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips the idempotent persistence when there is nothing to store', async () => {
    const findMany = jest.fn();
    const createMany = jest.fn();
    const update = jest.fn();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          sirePeriod: { update },
          sireProposal: { findMany, createMany },
        }),
    );

    await repository.saveSunatProposal(COMPANY_ID, '202610', 'RCE', []);

    expect(findMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('guards the fiscal period before writing proposals', async () => {
    prisma.sireReconciliation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'recon-1' });

    await expect(
      repository.ensurePeriodOpen(COMPANY_ID, '202610', 'RVIE'),
    ).resolves.toBeUndefined();
    await expect(
      repository.ensurePeriodOpen(COMPANY_ID, '202610', 'RCE'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.sireReconciliation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
      }),
    );
  });

  it('maps the stored proposals of a period into entities', async () => {
    prisma.sireProposal.findMany.mockResolvedValue([filaAlmacenada]);

    await expect(
      repository.findProposalsByPeriod(COMPANY_ID, '202610', 'RVIE'),
    ).resolves.toEqual([
      expect.objectContaining({ bookType: 'RVIE', totalAmount: 118 }),
    ]);
    await expect(
      repository.findProposalsByPeriod(COMPANY_ID, '202610', 'RCE'),
    ).resolves.toHaveLength(1);
    expect(prisma.sireProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RCE_COMPRAS' }),
      }),
    );
  });

  it('treats an incoming proposal without origin as SUNAT when comparing CAR data', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        car_sunat: 'CAR-1',
        period: '202610',
        emitter_ruc: '20100070970',
        document_type: '01',
        series: 'F001',
        correlative: '1',
        issue_date: new Date('2026-10-01T00:00:00.000Z'),
        taxable_base: 100,
        igv_amount: 18,
        total_amount: 118,
        origin: 'SUNAT',
      },
    ]);
    const createMany = jest.fn();
    const internals = repository as unknown as {
      saveProposalsIdempotently: (
        tx: unknown,
        proposals: Array<Record<string, unknown>>,
      ) => Promise<void>;
    };

    await internals.saveProposalsIdempotently(
      { sireProposal: { findMany, createMany } },
      [
        {
          company_id: COMPANY_ID,
          period: '202610',
          book_type: 'RCE_COMPRAS',
          car_sunat: 'CAR-1',
          emitter_ruc: '20100070970',
          document_type: '01',
          series: 'F001',
          correlative: '1',
          issue_date: new Date('2026-10-01T00:00:00.000Z'),
          taxable_base: 100,
          igv_amount: 18,
          total_amount: 118,
          origin: undefined,
        },
      ],
    );

    expect(createMany).not.toHaveBeenCalled();
  });

  it('delegates the reconciliation persistence and the fiscal period queries', async () => {
    const historial = { total: 0, items: [] };
    (persistSireReconciliation as jest.Mock).mockResolvedValue(undefined);
    (findSireReconciliationForExport as jest.Mock).mockResolvedValue(null);
    (getSireClosedHistory as jest.Mock).mockResolvedValue(historial);
    (closeSireFiscalPeriod as jest.Mock).mockResolvedValue(undefined);

    await repository.saveReconciliationResult({} as never);
    await expect(
      repository.findReconciliationForExport(COMPANY_ID, '202610', 'RCE'),
    ).resolves.toBeNull();
    await expect(
      repository.getClosedReconciliationHistory(COMPANY_ID, 0, 20),
    ).resolves.toBe(historial);
    await repository.closeFiscalPeriod(COMPANY_ID, '202610', 'RVIE');

    expect(persistSireReconciliation).toHaveBeenCalledWith(prisma, {});
    expect(findSireReconciliationForExport).toHaveBeenCalledWith(
      prisma,
      COMPANY_ID,
      '202610',
      'RCE',
    );
    expect(getSireClosedHistory).toHaveBeenCalledWith(
      prisma,
      COMPANY_ID,
      0,
      20,
    );
    expect(closeSireFiscalPeriod).toHaveBeenCalledWith(
      prisma,
      COMPANY_ID,
      '202610',
      'RVIE',
    );
  });
});

describe('SireMenuRepository uncovered branches', () => {
  let prisma: ReturnType<typeof crearPrismaMenu>;
  let repository: SireMenuRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = crearPrismaMenu();
    repository = new SireMenuRepository(prisma);
  });

  it('counts the imports and the reconciliations without a period filter', async () => {
    (prisma.sireImportacion.count as jest.Mock).mockResolvedValue(4);
    (prisma.sireConciliacion.count as jest.Mock).mockResolvedValue(2);

    await expect(repository.contarImportaciones(COMPANY_ID)).resolves.toBe(4);
    await expect(repository.contarConciliaciones(COMPANY_ID)).resolves.toBe(2);

    expect(prisma.sireImportacion.count).toHaveBeenCalledWith({
      where: { company_id: COMPANY_ID },
    });
    expect(prisma.sireConciliacion.count).toHaveBeenCalledWith({
      where: { company_id: COMPANY_ID },
    });
  });

  it('counts the reports filtered by period', async () => {
    (prisma.sireReporte.count as jest.Mock).mockResolvedValue(1);

    await expect(repository.contarReportes(COMPANY_ID, '202401')).resolves.toBe(
      1,
    );

    expect(prisma.sireReporte.count).toHaveBeenCalledWith({
      where: { company_id: COMPANY_ID, periodo: '202401' },
    });
  });
});

describe('SireDashboardMetricsRepository uncovered branches', () => {
  it('fails when the metrics query does not return any row', async () => {
    const rawQuery = jest.fn().mockResolvedValue([]);
    const repository = new SireDashboardMetricsRepository({
      $queryRaw: rawQuery,
    } as unknown as PrismaService);

    await expect(
      repository.getMetricsSummary(
        COMPANY_ID,
        new Date('2026-10-29T11:55:00.000Z'),
        new Date('2026-10-29T12:00:00.000Z'),
      ),
    ).rejects.toThrow('La consulta de métricas no devolvió resultados.');
  });
});
