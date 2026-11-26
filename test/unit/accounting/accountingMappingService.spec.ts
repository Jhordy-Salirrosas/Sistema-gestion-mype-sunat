import type { PrismaService } from '../../../src/database/prismaService';
import { AccountingMappingService } from '../../../src/modules/accounting/application/services/accountingMappingService';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    accountingMapping: { findMany: jest.fn().mockResolvedValue([]) },
    accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
    accountingAccount: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;
}

describe('AccountingMappingService', () => {
  it('devuelve la matriz PCGE por defecto de una venta como SALIDA', async () => {
    const service = new AccountingMappingService(prismaMock());

    const result = await service.getAccountsForOperation('VENTA', 'company-1');

    expect(result.operation).toBe('VENTA');
    expect(result.direction).toBe('SALIDA');
    expect(result.accounts.CXC.code).toBe('12121');
    expect(result.accounts.IGV.code).toBe('40111');
    expect(result.accounts.INGRESO.code).toBe('70121');
    expect(result.accounts.COSTO_VENTA.code).toBe('69111');
  });

  it('usa la compra como ENTRADA con 60/40/42', async () => {
    const service = new AccountingMappingService(prismaMock());

    const result = await service.getAccountsForOperation('COMPRA', 'company-1');

    expect(result.direction).toBe('ENTRADA');
    expect(result.accounts.COMPRA.code).toBe('60111');
    expect(result.accounts.IGV.code).toBe('40111');
    expect(result.accounts.CXP.code).toBe('42121');
  });

  it('hereda la matriz global y aplica las reglas del proceso como override', async () => {
    const prisma = prismaMock({
      accountingMapping: {
        findMany: jest.fn().mockResolvedValue([
          { role_code: 'CXC', account_code: '12122' },
          { role_code: 'IGV', account_code: '40112' },
        ]),
      },
      accountingRule: {
        findMany: jest.fn().mockResolvedValue([
          { line_order: 2, account_code: '40119' },
        ]),
      },
    });
    const service = new AccountingMappingService(prisma);

    const result = await service.getAccountsForOperation('VENTA', 'company-1');

    expect(result.accounts.CXC.code).toBe('12122');
    expect(result.accounts.IGV.code).toBe('40119');
    expect(result.accounts.INGRESO.code).toBe('70121');
  });

  it('resuelve las cuentas globales de SIRE y de importación', async () => {
    const service = new AccountingMappingService(prismaMock());

    const ventas = await service.getAccountsForOperation('SIRE_VENTAS', 'company-1');
    const compras = await service.getAccountsForOperation('SIRE_COMPRAS', 'company-1');
    const importacion = await service.getAccountsForOperation('IMPORTACION', 'company-1');

    expect(ventas.accounts.CXC.code).toBe('121');
    expect(compras.accounts.CXP.code).toBe('421');
    expect(importacion.direction).toBe('ENTRADA');
    expect(importacion.accounts.IGV_IMPORTACION.code).toBe('40111');
    expect(importacion.accounts.CXP_EXTERIOR.code).toBe('42122');
  });

  it('mapea roles legacy y reglas de importación por descripción', async () => {
    const prisma = prismaMock({
      accountingMapping: {
        findMany: jest.fn().mockResolvedValue([
          { role_code: 'VENTA_GRAVADA', account_code: '70299' },
        ]),
      },
      accountingRule: {
        findMany: jest.fn().mockResolvedValue([
          { line_order: 1, description: 'IGV_IMPORTACION', account_code: '40199' },
        ]),
      },
    });
    const service = new AccountingMappingService(prisma);

    const venta = await service.getAccountsForOperation('VENTA', 'company-1');
    const importacion = await service.getAccountsForOperation('IMPORTACION', 'company-1');

    expect(venta.accounts.INGRESO.code).toBe('70299');
    expect(importacion.accounts.IGV_IMPORTACION.code).toBe('40199');
  });

  it('usa los valores por defecto si el catálogo o las tablas no responden', async () => {
    const prisma = prismaMock({
      accountingMapping: { findMany: jest.fn().mockRejectedValue(new Error('sin tabla')) },
      accountingRule: { findMany: jest.fn().mockRejectedValue(new Error('sin tabla')) },
      accountingAccount: { findMany: jest.fn().mockRejectedValue(new Error('sin catálogo')) },
    });
    const service = new AccountingMappingService(prisma);

    const result = await service.getAccountsForOperation('DESCONOCIDA', 'company-1');

    expect(result.operation).toBe('VENTA');
    expect(result.accounts.CXC).toMatchObject({ code: '12121' });
  });

  it('prioriza el nombre del catálogo PCGE de la base de datos', async () => {
    const prisma = prismaMock({
      accountingAccount: {
        findMany: jest.fn().mockResolvedValue([{ code: '12121', name: 'CxC oficial' }]),
      },
    });
    const service = new AccountingMappingService(prisma);

    const result = await service.getAccountsForOperation('VENTA', 'company-1');

    expect(result.accounts.CXC.name).toBe('CxC oficial');
  });
});
