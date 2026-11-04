import { BadRequestException } from '@nestjs/common';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

const dto = {
  companyId: 'c1',
  period: '2026-11',
  entryDate: '2026-11-04T00:00:00.000Z',
  glosa: 'Ajuste',
  sourceModule: 'MANUAL',
  lines: [
    { lineOrder: 1, accountCode: '1211', accountName: 'CxC', debitAmount: 118, creditAmount: 0 },
    { lineOrder: 2, accountCode: '7011', accountName: 'Ventas', debitAmount: 0, creditAmount: 118 },
  ],
};

describe('GenerateAccountingEntryUseCase - validaciones de período y cuentas', () => {
  let repository: jest.Mocked<IAccountingRepositoryPort>;
  let useCase: GenerateAccountingEntryUseCase;

  beforeEach(() => {
    repository = {
      findPeriod: jest.fn(),
      openPeriod: jest.fn(),
      findAccounts: jest.fn(),
      getNextEntryNumber: jest.fn().mockResolvedValue(1),
      saveEntry: jest.fn().mockImplementation(async (entry) => entry),
    } as unknown as jest.Mocked<IAccountingRepositoryPort>;
    useCase = new GenerateAccountingEntryUseCase(repository);
  });

  it('rechaza un período cerrado', async () => {
    repository.findPeriod.mockResolvedValue({
      companyId: 'c1', period: '2026-11', year: 2026, month: 11,
      status: 'CERRADO', openedAt: new Date(),
    });
    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('abre el período si no existe', async () => {
    repository.findPeriod.mockResolvedValue(null);
    repository.findAccounts.mockResolvedValue([
      { code: '1211', name: 'CxC', element: 'Activo', nature: 'Deudora', parentCode: '12', level: 4, isActive: true },
      { code: '7011', name: 'Ventas', element: 'Ingresos', nature: 'Acreedora', parentCode: '70', level: 4, isActive: true },
    ]);
    await useCase.execute(dto);
    expect(repository.openPeriod).toHaveBeenCalledWith('c1', 2026, 11);
  });

  it('rechaza una cuenta que no está en el catálogo', async () => {
    repository.findPeriod.mockResolvedValue({
      companyId: 'c1', period: '2026-11', year: 2026, month: 11,
      status: 'ABIERTO', openedAt: new Date(),
    });
    repository.findAccounts.mockResolvedValue([]);
    await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
  });

  it('rechaza un período con formato inválido', async () => {
    await expect(useCase.execute({ ...dto, period: '202611' })).rejects.toThrow(BadRequestException);
  });
});
