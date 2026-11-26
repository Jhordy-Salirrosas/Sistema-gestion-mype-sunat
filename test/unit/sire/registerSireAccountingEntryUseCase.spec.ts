import { NotFoundException } from '@nestjs/common';
import { RegisterSireAccountingEntryUseCase } from '../../../src/modules/sire/application/use-cases/registerSireAccountingEntryUseCase';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';
import type { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import type { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';
import type { AccountingMappingService } from '../../../src/modules/accounting/application/services/accountingMappingService';

describe('RegisterSireAccountingEntryUseCase', () => {
  const entry = { id: 'entry-1' };
  let mappings: jest.Mocked<ISireAccountingMappingRepositoryPort>;
  let accounting: { execute: jest.Mock };
  let accountingAccounts: { execute: jest.Mock };

  beforeEach(() => {
    mappings = {
      findAll: jest.fn().mockResolvedValue([
        { tipoOperacion: 'VENTAS', cuentaContable: '121' },
        { tipoOperacion: 'BASE_VENTAS', cuentaContable: '701' },
        { tipoOperacion: 'IGV', cuentaContable: '40111' },
        { tipoOperacion: 'COMPRAS', cuentaContable: '421' },
        { tipoOperacion: 'BASE_COMPRAS', cuentaContable: '601' },
      ]),
      upsertMany: jest.fn(),
    };
    accounting = { execute: jest.fn().mockResolvedValue(entry) };
    accountingAccounts = {
      execute: jest.fn().mockResolvedValue([
        { code: '121', name: 'Clientes nacionales', isActive: true },
        { code: '701', name: 'Ingresos por ventas', isActive: true },
        { code: '40111', name: 'IGV por pagar', isActive: true },
        { code: '421', name: 'Proveedores nacionales', isActive: true },
        { code: '601', name: 'Gastos por compras', isActive: true },
      ]),
    };
  });

  function createUseCase(globalMappings?: AccountingMappingService) {
    return new RegisterSireAccountingEntryUseCase(
      mappings,
      accounting as unknown as GenerateAccountingEntryUseCase,
      accountingAccounts as unknown as ListAccountingAccountsUseCase,
      globalMappings,
    );
  }

  const globalMappings = {
    getAccountsForOperation: jest.fn().mockImplementation(async (operation: string) => ({
      operation,
      direction: operation === 'SIRE_VENTAS' ? 'SALIDA' : 'ENTRADA',
      accounts: operation === 'SIRE_VENTAS'
        ? {
            CXC: { code: '122', name: 'CxC global' },
            IGV: { code: '40112', name: 'IGV global' },
            INGRESO: { code: '702', name: 'Ingreso global' },
          }
        : {
            CXP: { code: '422', name: 'CxP global' },
            IGV: { code: '40112', name: 'IGV global' },
            COMPRA: { code: '602', name: 'Compra global' },
          },
    })),
  } as unknown as AccountingMappingService;

  const records = [
    {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '00000001',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
    },
  ];

  it('no consulta el mapeo cuando no hay comprobantes', async () => {
    await expect(
      createUseCase().execute('company-1', '202603', 'RVIE_VENTAS', []),
    ).resolves.toBeNull();
    expect(mappings.findAll).not.toHaveBeenCalled();
    expect(accounting.execute).not.toHaveBeenCalled();
  });

  it('no genera asiento cuando los importes son cero', async () => {
    await expect(
      createUseCase().execute('company-1', '202603', 'RVIE_VENTAS', [
        {
          ...records[0],
          taxableBase: 0,
          igvAmount: 0,
          totalAmount: 0,
        },
      ]),
    ).resolves.toBeNull();
    expect(mappings.findAll).not.toHaveBeenCalled();
  });

  it('genera el asiento de ventas con la clave de idempotencia del periodo', async () => {
    const result = await createUseCase().execute(
      'company-1',
      '202603',
      'RVIE_VENTAS',
      records,
    );

    expect(result).toBe(entry);
    expect(accounting.execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      period: '2026-03',
      entryDate: '2026-03-31T00:00:00.000Z',
      glosa: 'Asiento de conciliación SIRE ventas 202603',
      sourceModule: 'SIRE',
      journalCode: 'SIRE',
      sourceReferenceId: '202603-RVIE_VENTAS',
      idempotencyKey: 'sire-202603-RVIE_VENTAS',
      lines: [
        {
          lineOrder: 1,
          accountCode: '121',
          accountName: 'Clientes nacionales',
          debitAmount: 118,
          creditAmount: 0,
        },
        {
          lineOrder: 2,
          accountCode: '701',
          accountName: 'Ingresos por ventas',
          debitAmount: 0,
          creditAmount: 100,
        },
        {
          lineOrder: 3,
          accountCode: '40111',
          accountName: 'IGV por pagar',
          debitAmount: 0,
          creditAmount: 18,
        },
      ],
    });
    expect(accountingAccounts.execute).toHaveBeenCalledWith(true);
  });

  it('genera el asiento de compras con las cuentas del mapeo', async () => {
    await createUseCase().execute(
      'company-1',
      '202601',
      'RCE_COMPRAS',
      records,
    );

    expect(accounting.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '2026-01',
        entryDate: '2026-01-31T00:00:00.000Z',
        glosa: 'Asiento de conciliación SIRE compras 202601',
        idempotencyKey: 'sire-202601-RCE_COMPRAS',
        lines: [
          expect.objectContaining({
            accountCode: '601',
            accountName: 'Gastos por compras',
            debitAmount: 100,
          }),
          expect.objectContaining({
            accountCode: '40111',
            accountName: 'IGV por pagar',
            debitAmount: 18,
          }),
          expect.objectContaining({
            accountCode: '421',
            accountName: 'Proveedores nacionales',
            creditAmount: 118,
          }),
        ],
      }),
    );
  });

  it('hereda las cuentas globales cuando SIRE no tiene mapeo propio', async () => {
    mappings.findAll.mockResolvedValue([]);

    await createUseCase(globalMappings).execute(
      'company-1',
      '202603',
      'RVIE_VENTAS',
      records,
    );

    expect(globalMappings.getAccountsForOperation).toHaveBeenCalledWith(
      'SIRE_VENTAS',
      'company-1',
    );
    expect(accounting.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({ accountCode: '122', debitAmount: 118 }),
          expect.objectContaining({ accountCode: '702', creditAmount: 100 }),
          expect.objectContaining({ accountCode: '40112', creditAmount: 18 }),
        ],
      }),
    );
  });

  it('hereda las cuentas globales de compras', async () => {
    mappings.findAll.mockResolvedValue([]);

    await createUseCase(globalMappings).execute(
      'company-1',
      '202603',
      'RCE_COMPRAS',
      records,
    );

    expect(accounting.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({ accountCode: '602', debitAmount: 100 }),
          expect.objectContaining({ accountCode: '40112', debitAmount: 18 }),
          expect.objectContaining({ accountCode: '422', creditAmount: 118 }),
        ],
      }),
    );
  });

  it('rechaza empresas inexistentes cuando el mapeo devuelve null', async () => {
    mappings.findAll.mockResolvedValue(null);

    await expect(
      createUseCase().execute('missing', '202603', 'RVIE_VENTAS', records),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(accounting.execute).not.toHaveBeenCalled();
  });
});
