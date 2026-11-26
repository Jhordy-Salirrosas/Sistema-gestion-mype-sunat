import { NotFoundException } from '@nestjs/common';
import { GetSireAccountingPreviewUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingPreviewUseCase';
import type { ISireAccountingPreviewRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingPreviewRepositoryPort';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';
import type { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';
import type { AccountingMappingService } from '../../../src/modules/accounting/application/services/accountingMappingService';

describe('GetSireAccountingPreviewUseCase', () => {
  let totalsRepository: jest.Mocked<ISireAccountingPreviewRepositoryPort>;
  let mappingRepository: jest.Mocked<ISireAccountingMappingRepositoryPort>;
  let accountingAccounts: ListAccountingAccountsUseCase & { execute: jest.Mock };
  let useCase: GetSireAccountingPreviewUseCase;

  beforeEach(() => {
    totalsRepository = {
      findPeriodTotals: jest.fn().mockResolvedValue([
        {
          bookType: 'RVIE_VENTAS',
          taxableBase: 1000,
          igvAmount: 180,
          totalAmount: 1180,
          comprobantes: 4,
        },
        {
          bookType: 'RCE_COMPRAS',
          taxableBase: 500,
          igvAmount: 90,
          totalAmount: 590,
          comprobantes: 2,
        },
      ]),
    };
    mappingRepository = {
      findAll: jest.fn().mockResolvedValue([
        { tipoOperacion: 'VENTAS', cuentaContable: '121' },
        { tipoOperacion: 'COMPRAS', cuentaContable: '421' },
        { tipoOperacion: 'BASE_VENTAS', cuentaContable: '701' },
        { tipoOperacion: 'BASE_COMPRAS', cuentaContable: '601' },
        { tipoOperacion: 'IGV', cuentaContable: '40111' },
      ]),
      upsertMany: jest.fn(),
    };
    accountingAccounts = {
      execute: jest.fn().mockResolvedValue([
        { code: '121', name: 'Clientes nacionales', element: '1', nature: 'Deudora', parentCode: null, level: 3, isActive: true },
        { code: '421', name: 'Proveedores nacionales', element: '4', nature: 'Acreedora', parentCode: null, level: 3, isActive: true },
        { code: '701', name: 'Ingresos por ventas', element: '7', nature: 'Acreedora', parentCode: null, level: 3, isActive: true },
        { code: '601', name: 'Gastos por compras', element: '6', nature: 'Deudora', parentCode: null, level: 3, isActive: true },
        { code: '40111', name: 'IGV por pagar', element: '4', nature: 'Acreedora', parentCode: null, level: 5, isActive: true },
      ]),
    } as unknown as ListAccountingAccountsUseCase & { execute: jest.Mock };
    useCase = new GetSireAccountingPreviewUseCase(
      totalsRepository,
      mappingRepository,
      accountingAccounts,
    );
  });

  it('devuelve la previsualización de ventas y compras del periodo', async () => {
    const result = await useCase.execute('company-1', '202602');

    expect(totalsRepository.findPeriodTotals).toHaveBeenCalledWith(
      'company-1',
      '202602',
    );
    expect(result.periodo).toBe('202602');
    expect(result.asientos).toHaveLength(2);
    expect(result.asientos[0]).toMatchObject({
      libro: 'RVIE_VENTAS',
      glosa: 'Asiento SIRE ventas 202602',
      fecha: '2026-02-28',
      totales: { base: 1000, igv: 180, total: 1180, comprobantes: 4 },
    });
    expect(result.asientos[0].lineas).toEqual([
      expect.objectContaining({ cuenta: '121', nombre: 'Clientes nacionales', debe: 1180 }),
      expect.objectContaining({ cuenta: '701', nombre: 'Ingresos por ventas', haber: 1000 }),
      expect.objectContaining({ cuenta: '40111', nombre: 'IGV por pagar', haber: 180 }),
    ]);
    expect(accountingAccounts.execute).toHaveBeenCalledWith(true);
    expect(result.asientos[1]).toMatchObject({
      libro: 'RCE_COMPRAS',
      glosa: 'Asiento SIRE compras 202602',
    });
    expect(result.asientos[1].lineas[0]).toMatchObject({
      cuenta: '601',
      debe: 500,
    });
  });

  it('hereda las cuentas globales cuando no hay mapeo SIRE propio', async () => {
    mappingRepository.findAll.mockResolvedValue([]);
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
    const inheritedUseCase = new GetSireAccountingPreviewUseCase(
      totalsRepository,
      mappingRepository,
      accountingAccounts,
      globalMappings,
    );

    const result = await inheritedUseCase.execute('company-1', '202602');

    expect(result.asientos[0].lineas).toEqual([
      expect.objectContaining({ cuenta: '122', nombre: 'CxC global', debe: 1180 }),
      expect.objectContaining({ cuenta: '702', nombre: 'Ingreso global', haber: 1000 }),
      expect.objectContaining({ cuenta: '40112', nombre: 'IGV global', haber: 180 }),
    ]);
    expect(result.asientos[1].lineas[0]).toMatchObject({
      cuenta: '602',
      nombre: 'Compra global',
      debe: 500,
    });
  });

  it('filtra el libro solicitado', async () => {
    const result = await useCase.execute(
      'company-1',
      '202602',
      'RCE_COMPRAS',
    );

    expect(result.asientos).toHaveLength(1);
    expect(result.asientos[0].libro).toBe('RCE_COMPRAS');
  });

  it('rechaza empresas inexistentes', async () => {
    mappingRepository.findAll.mockResolvedValue(null);

    await expect(useCase.execute('missing', '202602')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza periodos sin importaciones', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([]);

    await expect(
      useCase.execute('company-1', '202601'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza libros solicitados sin importaciones', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([
      {
        bookType: 'RVIE_VENTAS',
        taxableBase: 100,
        igvAmount: 18,
        totalAmount: 118,
        comprobantes: 1,
      },
    ]);

    await expect(
      useCase.execute('company-1', '202602', 'RCE_COMPRAS'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omite libros con importes en cero', async () => {
    totalsRepository.findPeriodTotals.mockResolvedValue([
      {
        bookType: 'RVIE_VENTAS',
        taxableBase: 0,
        igvAmount: 0,
        totalAmount: 0,
        comprobantes: 1,
      },
    ]);

    await expect(
      useCase.execute('company-1', '202602'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
