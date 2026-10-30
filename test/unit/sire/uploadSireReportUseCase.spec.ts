import { BadRequestException, ConflictException } from '@nestjs/common';
import { UploadSireReportUseCase } from '../../../src/modules/sire/application/use-cases/uploadSireReportUseCase';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';
import { SireReportFileParser } from '../../../src/modules/sire/infrastructure/parsers/sireReportFileParser';

describe('UploadSireReportUseCase', () => {
  let repository: jest.Mocked<ISireRepositoryPort>;
  let parser: jest.Mocked<SireReportFileParser>;
  let useCase: UploadSireReportUseCase;

  beforeEach(() => {
    repository = {
      hasReportUploadHash: jest.fn().mockResolvedValue(false),
      saveReportUpload: jest.fn().mockResolvedValue(undefined),
      ensurePeriodOpen: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ISireRepositoryPort>;
    parser = {
      parse: jest.fn().mockReturnValue({
        records: [
          {
            emitterRuc: '20100070970',
            documentType: '01',
            series: 'F001',
            correlative: '1',
            issueDate: new Date('2026-10-01T00:00:00.000Z'),
            taxableBase: 100,
            igvAmount: 18,
            totalAmount: 118,
            carSunat: 'CAR-1',
          },
        ],
        rejected: [{ line: 3, reason: 'Fila inválida.' }],
      }),
    } as unknown as jest.Mocked<SireReportFileParser>;
    useCase = new UploadSireReportUseCase(repository, parser);
  });

  it('rejects an empty file', async () => {
    await expect(
      useCase.execute(
        { period: '202610', bookType: 'RCE_COMPRAS' },
        'company-a',
        { originalname: 'rce.csv', buffer: Buffer.alloc(0) },
      ),
    ).rejects.toThrow(new BadRequestException('El archivo está vacío.'));
    expect(repository.hasReportUploadHash).not.toHaveBeenCalled();
  });

  it('rejects a file already uploaded for the company', async () => {
    repository.hasReportUploadHash.mockResolvedValue(true);

    await expect(
      useCase.execute(
        { period: '202610', bookType: 'RCE_COMPRAS' },
        'company-a',
        { originalname: 'rce.csv', buffer: Buffer.from('duplicate') },
      ),
    ).rejects.toThrow(
      new ConflictException('El archivo ya fue cargado para esta empresa.'),
    );
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('rejects a file without valid records and exposes row errors', async () => {
    parser.parse.mockReturnValue({ records: [], rejected: [{ line: 2, reason: 'CAR inválido.' }] });

    await expect(
      useCase.execute(
        { period: '202610', bookType: 'RVIE_VENTAS' },
        'company-a',
        { originalname: 'rvie.xlsx', buffer: Buffer.from('invalid') },
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'El archivo no contiene filas válidas.',
        errors: [{ line: 2, reason: 'CAR inválido.' }],
      },
    });
    expect(repository.saveReportUpload).not.toHaveBeenCalled();
  });

  it('persists valid records with the selected book and returns the hash', async () => {
    const file = { originalname: 'rce.csv', buffer: Buffer.from('valid report') };

    const result = await useCase.execute(
      { period: '202610', bookType: 'RCE_COMPRAS' },
      'company-a',
      file,
    );

    expect(repository.ensurePeriodOpen).toHaveBeenCalledWith(
      'company-a',
      '202610',
      'RCE',
    );
    expect(repository.saveReportUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        period: '202610',
        bookType: 'RCE',
        fileName: 'rce.csv',
        proposals: [
          expect.objectContaining({
            companyId: 'company-a',
            period: '202610',
            bookType: 'RCE',
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      imported: 1,
      rejected: 1,
      fileName: 'rce.csv',
      reportType: 'RCE',
    });
    expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not save when the period is closed', async () => {
    repository.ensurePeriodOpen.mockRejectedValue(
      new ConflictException('El periodo fiscal está cerrado.'),
    );

    await expect(
      useCase.execute(
        { period: '202610', bookType: 'RVIE_VENTAS' },
        'company-a',
        { originalname: 'rvie.xlsx', buffer: Buffer.from('valid report') },
      ),
    ).rejects.toThrow('El periodo fiscal está cerrado.');
    expect(repository.saveReportUpload).not.toHaveBeenCalled();
  });
});
