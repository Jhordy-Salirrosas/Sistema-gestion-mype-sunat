import { NotFoundException } from '@nestjs/common';
import { RegisterSireAccountingEntryUseCase } from '../../../src/modules/sire/application/use-cases/registerSireAccountingEntryUseCase';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';
import type { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';

describe('RegisterSireAccountingEntryUseCase', () => {
  const entry = { id: 'entry-1' };
  let mappings: jest.Mocked<ISireAccountingMappingRepositoryPort>;
  let accounting: { execute: jest.Mock };

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
  });

  function createUseCase() {
    return new RegisterSireAccountingEntryUseCase(
      mappings,
      accounting as unknown as GenerateAccountingEntryUseCase,
    );
  }

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
          accountName: 'Cuentas por cobrar comerciales',
          debitAmount: 118,
          creditAmount: 0,
        },
        {
          lineOrder: 2,
          accountCode: '701',
          accountName: 'Ventas de mercaderías',
          debitAmount: 0,
          creditAmount: 100,
        },
        {
          lineOrder: 3,
          accountCode: '40111',
          accountName: 'IGV cuenta propia',
          debitAmount: 0,
          creditAmount: 18,
        },
      ],
    });
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
          expect.objectContaining({ accountCode: '601', debitAmount: 100 }),
          expect.objectContaining({ accountCode: '40111', debitAmount: 18 }),
          expect.objectContaining({ accountCode: '421', creditAmount: 118 }),
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
