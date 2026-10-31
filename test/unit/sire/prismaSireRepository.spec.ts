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
});
