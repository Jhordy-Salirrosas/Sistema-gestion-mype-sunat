import { PrismaSireRepository } from '../../../src/modules/sire/infrastructure/persistence/prismaSireRepository';

describe('PrismaSireRepository report uploads', () => {
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

  it('checks whether a company has already uploaded a file hash', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'upload-1' })
      .mockResolvedValueOnce(null);
    const repository = new PrismaSireRepository({
      sireReportUpload: { findUnique },
    } as never);

    await expect(
      repository.hasReportUploadHash('company-a', 'hash-1'),
    ).resolves.toBe(true);
    await expect(
      repository.hasReportUploadHash('company-a', 'hash-2'),
    ).resolves.toBe(false);
    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        company_id_file_hash: {
          company_id: 'company-a',
          file_hash: 'hash-1',
        },
      },
      select: { id: true },
    });
  });

  it('persists an RCE upload and links its proposals atomically', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'upload-1' });
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        sireReportUpload: { create },
        sireProposal: { createMany },
      }),
    );
    const repository = new PrismaSireRepository({
      $transaction: transaction,
    } as never);

    await repository.saveReportUpload({
      companyId: 'company-a',
      period: '202610',
      bookType: 'RCE',
      fileName: 'rce.csv',
      fileHash: 'hash-1',
      proposals: [proposal],
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        company_id: 'company-a',
        book_type: 'RCE_COMPRAS',
        archivo_origen: 'rce.csv',
        tipo_reporte: 'RCE',
        file_hash: 'hash-1',
      }),
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          company_id: 'company-a',
          book_type: 'RCE_COMPRAS',
          source_upload_id: 'upload-1',
          car_sunat: 'CAR-1',
        }),
      ],
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('maps RVIE uploads to the ventas enum', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'upload-2' });
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        sireReportUpload: { create },
        sireProposal: { createMany },
      }),
    );
    const repository = new PrismaSireRepository({
      $transaction: transaction,
    } as never);

    await repository.saveReportUpload({
      companyId: 'company-a',
      period: '202610',
      bookType: 'RVIE',
      fileName: 'rvie.xlsx',
      fileHash: 'hash-2',
      proposals: [{ ...proposal, bookType: 'RVIE' }],
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ book_type: 'RVIE_VENTAS' }),
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ book_type: 'RVIE_VENTAS' })],
    });
  });

  it('persists and reads the SIRE period lifecycle', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'period-1', state: 'PROPUESTA' });
    const findUnique = jest.fn().mockResolvedValue({
        id: 'period-1',
        state: 'PROCESANDO_GENERACION',
        ticket: 'T-1',
        ticket_operation: 'GENERACION',
      });
    const deleteMany = jest.fn();
    const createMany = jest.fn();
    const update = jest.fn();
    const repository = new PrismaSireRepository({
        sirePeriod: { upsert, findUnique, update },
        sireProposal: { deleteMany, createMany },
        $transaction: jest.fn().mockResolvedValue([]),
    } as never);

    await expect(repository.upsertPeriod('company-a', '202610', 'RCE')).resolves.toEqual({
        id: 'period-1',
        state: 'PROPUESTA',
      });
    await expect(repository.getPeriod('company-a', '202610', 'RCE')).resolves.toEqual({
        id: 'period-1',
        state: 'PROCESANDO_GENERACION',
        ticket: 'T-1',
        ticketOperation: 'GENERACION',
      });
    await repository.saveSunatProposal('company-a', '202610', 'RCE', [
        proposal,
        { ...proposal, origin: 'USUARIO' },
      ]);
    expect(deleteMany).toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ origin: 'SUNAT', book_type: 'RCE_COMPRAS' }),
          expect.objectContaining({ origin: 'USUARIO', book_type: 'RCE_COMPRAS' }),
        ],
      });
    expect(update).toHaveBeenCalled();
  });

    it('enforces proposal origin and updates ticket/state transitions', async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'p-1',
          origin: 'SUNAT',
          period_id: 'period-1',
          period_record: { state: 'PROPUESTA' },
        })
        .mockResolvedValueOnce({
          id: 'p-2',
          origin: 'USUARIO',
          period_id: 'period-1',
          period_record: { state: 'PROPUESTA' },
        });
      const proposalUpdate = jest.fn();
      const updateMany = jest.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      const findMany = jest.fn().mockResolvedValue([
        {
          company_id: 'company-a',
          period: '202610',
          book_type: 'RVIE_VENTAS',
          car_sunat: 'CAR-1',
          issue_date: new Date('2026-10-01'),
          emitter_ruc: '20100070970',
          document_type: '01',
          series: 'F001',
          correlative: '1',
          taxable_base: { toNumber: () => 100 },
          igv_amount: { toNumber: () => 18 },
          total_amount: { toNumber: () => 118 },
        },
      ]);
      const repository = new PrismaSireRepository({
        sireProposal: { findFirst, update: proposalUpdate, updateMany, findMany },
        sirePeriod: { updateMany },
      } as never);

      await repository.excludeSunatProposal('company-a', 'p-1', 'user-a');
      await expect(repository.excludeSunatProposal('company-a', 'p-2', 'user-a')).rejects.toBeInstanceOf(Error);
      await repository.restoreProposal('company-a', 'p-1');
      await expect(repository.restoreProposal('company-a', 'missing')).rejects.toBeInstanceOf(Error);
      await expect(repository.getPeriodProposals('company-a', '202610', 'RVIE')).resolves.toEqual([
        expect.objectContaining({ bookType: 'RVIE', totalAmount: 118 }),
      ]);
      await repository.setPeriodTicket('company-a', '202610', 'RCE', 'PROCESANDO_GENERACION', 'T-1', 'GENERACION');
      await expect(repository.setPeriodTicket('company-a', '202610', 'RCE', 'GENERADO', 'T-2', 'GENERACION')).rejects.toBeInstanceOf(Error);
      await repository.setPeriodState('company-a', '202610', 'RCE', 'ERROR', 'falló');
      await expect(repository.setPeriodState('company-a', '202610', 'RCE', 'GENERADO')).rejects.toBeInstanceOf(Error);
      expect(proposalUpdate).toHaveBeenCalled();
    });
});
