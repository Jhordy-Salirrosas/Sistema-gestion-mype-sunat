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

    await repository.saveBatchProposals([proposal]);

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
});
