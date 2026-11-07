import { ConflictException } from '@nestjs/common';
import { PrismaSireRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireRepository';

describe('SIRE CAR idempotency', () => {
  const proposal = {
    companyId: 'company-a',
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

  function existingRecord(overrides: Record<string, unknown> = {}) {
    return {
      car_sunat: proposal.carSunat,
      period: proposal.period,
      emitter_ruc: proposal.emitterRuc,
      document_type: proposal.documentType,
      series: proposal.series,
      correlative: proposal.correlative,
      issue_date: proposal.issueDate,
      taxable_base: { toFixed: () => '100.00' },
      igv_amount: { toFixed: () => '18.00' },
      total_amount: { toFixed: () => '118.00' },
      origin: 'SUNAT',
      ...overrides,
    };
  }

  function createRepository(
    existing: unknown[] = [],
    createMany = jest.fn().mockResolvedValue({ count: 1 }),
    rootFindMany = jest.fn().mockResolvedValue(existing),
  ) {
    const txFindMany = jest.fn().mockResolvedValue(existing);
    const findFirst = jest.fn().mockResolvedValue(null);
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          sireProposal: { findMany: txFindMany, createMany },
          sireReconciliation: { findFirst },
        }),
    );
    const repository = new PrismaSireRepository({
      sireProposal: { findMany: rootFindMany },
      $transaction: transaction,
    } as never);
    return { repository, txFindMany, createMany, rootFindMany, transaction };
  }

  it('no-op en un reintento con el mismo CAR y los mismos datos', async () => {
    const { repository, createMany, txFindMany } = createRepository([
      existingRecord(),
    ]);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).resolves.toBeUndefined();

    expect(txFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company_id: 'company-a',
          book_type: 'RCE_COMPRAS',
          car_sunat: { in: ['CAR-1'] },
        }),
      }),
    );
    expect(createMany).not.toHaveBeenCalled();
  });

  it('responde 409 y no altera datos cuando el CAR existe con otra información', async () => {
    const { repository, createMany } = createRepository([
      existingRecord({ total_amount: { toFixed: () => '119.00' } }),
    ]);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'SIRE_CAR_ALREADY_EXISTS',
      }),
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('conserva aislamiento por empresa y libro en la búsqueda del CAR', async () => {
    const { repository, txFindMany, createMany } = createRepository();

    await repository.saveBatchProposals([{ ...proposal, origin: 'USUARIO' }]);

    expect(txFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company_id: 'company-a',
          book_type: 'RCE_COMPRAS',
        }),
      }),
    );
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('no abre transacción para una importación vacía y rechaza lotes de distintos ámbitos', async () => {
    const { repository, transaction } = createRepository();

    await expect(repository.saveBatchProposals([])).resolves.toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();

    await expect(
      repository.saveBatchProposals([
        proposal,
        { ...proposal, companyId: 'company-b' },
      ]),
    ).rejects.toThrow('La importación debe pertenecer a una empresa, periodo y libro.');
    await expect(
      repository.saveBatchProposals([
        proposal,
        { ...proposal, period: '202611' },
      ]),
    ).rejects.toThrow('La importación debe pertenecer a una empresa, periodo y libro.');
  });

  it('rechaza CAR repetido con datos incompatibles dentro de un mismo archivo', async () => {
    const { repository, createMany } = createRepository();

    await expect(
      repository.saveBatchProposals([
        proposal,
        { ...proposal, totalAmount: 119 },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('trata una carrera de inserción idéntica como un reintento exitoso', async () => {
    const racedRecord = existingRecord();
    const createMany = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['company_id', 'book_type', 'car_sunat'] },
    });
    const rootFindMany = jest.fn().mockResolvedValue([racedRecord]);
    const { repository } = createRepository([], createMany, rootFindMany);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).resolves.toBeUndefined();
    expect(rootFindMany).toHaveBeenCalled();
  });

  it('trata decimales almacenados como texto y un origen legado nulo como replay idéntico', async () => {
    const legacyRecord = existingRecord({
      origin: null,
      taxable_base: '100',
      igv_amount: '18.0',
      total_amount: '118.00',
    });
    const { repository, createMany } = createRepository([legacyRecord]);

    await expect(repository.saveBatchProposals([proposal])).resolves.toBeUndefined();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('mapea una carrera de CAR en RVIE usando el target de Prisma como texto', async () => {
    const rvieProposal = { ...proposal, bookType: 'RVIE' as const };
    const createMany = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: 'company_id,book_type,car_sunat' },
    });
    const rootFindMany = jest.fn().mockResolvedValue([existingRecord()]);
    const { repository } = createRepository([], createMany, rootFindMany);

    await expect(
      repository.saveBatchProposals([rvieProposal]),
    ).resolves.toBeUndefined();
    expect(rootFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
      }),
    );
  });

  it('devuelve 409 si la carrera P2002 no corresponde al mismo CAR', async () => {
    const createMany = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['company_id', 'book_type', 'car_sunat'] },
    });
    const rootFindMany = jest.fn().mockResolvedValue([]);
    const { repository } = createRepository([], createMany, rootFindMany);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('no clasifica P2002 con target no estructurado como conflicto de CAR', async () => {
    const prismaError = {
      code: 'P2002',
      meta: {},
    };
    const createMany = jest.fn().mockRejectedValue(prismaError);
    const rootFindMany = jest.fn().mockResolvedValue([]);
    const { repository } = createRepository([], createMany, rootFindMany);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).rejects.toBe(prismaError);
    expect(rootFindMany).not.toHaveBeenCalled();
  });

  it('no transforma otros errores de persistencia en conflictos de CAR', async () => {
    const persistenceError = new Error('simulated database failure');
    const createMany = jest.fn().mockRejectedValue(persistenceError);
    const rootFindMany = jest.fn();
    const { repository } = createRepository([], createMany, rootFindMany);

    await expect(
      repository.saveBatchProposals([proposal]),
    ).rejects.toBe(persistenceError);
    expect(rootFindMany).not.toHaveBeenCalled();
  });

  it('rechaza un P2002 de carga vacía sin intentar buscar un CAR', async () => {
    const prismaError = {
      code: 'P2002',
      meta: { target: 'sire_proposals_company_id_book_type_car_sunat_key' },
    };
    const findMany = jest.fn();
    const repository = new PrismaSireRepository({
      sireProposal: { findMany },
      $transaction: jest.fn().mockRejectedValue(prismaError),
    } as never);

    await expect(
      repository.saveReportUpload({
        companyId: 'company-a',
        period: '202610',
        bookType: 'RVIE',
        fileName: 'empty.csv',
        fileHash: 'fake-hash',
        proposals: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('propaga errores no-objeto de la base sin clasificarlos como P2002', async () => {
    const findMany = jest.fn();
    const repository = new PrismaSireRepository({
      sireProposal: { findMany },
      $transaction: jest.fn().mockRejectedValue('database failure'),
    } as never);

    await expect(
      repository.saveReportUpload({
        companyId: 'company-a',
        period: '202610',
        bookType: 'RCE',
        fileName: 'report.csv',
        fileHash: 'fake-hash',
        proposals: [proposal],
      }),
    ).rejects.toBe('database failure');
    expect(findMany).not.toHaveBeenCalled();
  });
});
