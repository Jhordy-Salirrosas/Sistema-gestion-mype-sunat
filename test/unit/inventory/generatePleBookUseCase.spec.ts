import { BadRequestException } from '@nestjs/common';
import { GeneratePleBookUseCase } from '../../../src/modules/inventory/application/use-cases/generatePleBookUseCase';

describe('GeneratePleBookUseCase', () => {
  let useCase: GeneratePleBookUseCase;
  let movementRepoMock: any;
  let ple13AdapterMock: any;
  let ple12AdapterMock: any;

  beforeEach(() => {
    movementRepoMock = {
      findAllByCompany: jest.fn().mockResolvedValue([
        {
          id: 'mov-1',
          sku: 'LAP-001',
          movementDate: new Date('2026-05-15'),
          documentTypeCode: '50',
          documentSerial: '118',
          documentNumber: '048291',
          operationTypeCode: '18',
          productDescription: 'Laptop Core i7',
          direction: 'ENTRADA',
          quantity: 10,
          unitCost: 2000,
          totalCost: 20000,
          resultingStock: 10,
          resultingUnitCost: 2000,
          resultingTotalValue: 20000,
        },
        {
          id: 'mov-2',
          sku: 'LAP-001',
          movementDate: new Date('2026-06-01'),
          documentTypeCode: undefined,
          documentSerial: undefined,
          documentNumber: undefined,
          operationTypeCode: '01',
          productDescription: 'Laptop Core i7',
          direction: 'SALIDA',
          quantity: 2,
          unitCost: 2000,
          totalCost: 4000,
          resultingStock: 8,
          resultingUnitCost: 2000,
          resultingTotalValue: 16000,
        },
      ]),
    };

    ple13AdapterMock = {
      generate: jest.fn().mockReturnValue({
        fileName: 'LE20601012341202600130100001111.txt',
        content: 'PLE 13.1 CONTENT',
        recordsCount: 2,
      }),
    };

    ple12AdapterMock = {
      generate: jest.fn().mockReturnValue({
        fileName: 'LE20601012341202600120100001111.txt',
        content: 'PLE 12.1 CONTENT',
        recordsCount: 2,
      }),
    };

    useCase = new GeneratePleBookUseCase(
      movementRepoMock,
      ple13AdapterMock,
      ple12AdapterMock,
    );
  });

  it('arroja BadRequestException si no se especifica companyId o companyRuc', async () => {
    await expect(
      useCase.execute({ book_type: '13.1', fiscal_year: 2026 }, '', '20601012341'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({ book_type: '13.1', fiscal_year: 2026 }, 'comp-1', ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('genera con éxito el libro PLE 13.1 (Inventario Permanente Valorizado)', async () => {
    const res = await useCase.execute(
      { book_type: '13.1', fiscal_year: 2026, month: '05' },
      'comp-1',
      '20601012341',
    );

    expect(movementRepoMock.findAllByCompany).toHaveBeenCalled();
    expect(ple13AdapterMock.generate).toHaveBeenCalledWith(
      '20601012341',
      2026,
      expect.arrayContaining([
        expect.objectContaining({
          periodYearMonth: '20260500',
          sku: 'LAP-001',
          documentTypeCode: '50',
          direction: 'ENTRADA',
        }),
        expect.objectContaining({
          documentTypeCode: '00',
          documentSerial: '-',
          documentNumber: '-',
          direction: 'SALIDA',
        }),
      ]),
    );
    expect(res.fileName).toBe('LE20601012341202600130100001111.txt');
  });

  it('genera con éxito el libro PLE 12.1 (Registro de Unidades Físicas)', async () => {
    const res = await useCase.execute(
      { book_type: '12.1', fiscal_year: 2026 },
      'comp-1',
      '20601012341',
    );

    expect(movementRepoMock.findAllByCompany).toHaveBeenCalled();
    expect(ple12AdapterMock.generate).toHaveBeenCalledWith(
      '20601012341',
      2026,
      expect.arrayContaining([
        expect.objectContaining({
          periodYearMonth: '20260000',
          sku: 'LAP-001',
          direction: 'ENTRADA',
        }),
      ]),
    );
    expect(res.fileName).toBe('LE20601012341202600120100001111.txt');
  });
});
