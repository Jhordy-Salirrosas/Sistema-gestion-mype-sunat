import { BadRequestException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

const dto = {
  supplierDocNumber: '20100070970', supplierName: 'Proveedor', documentTypeCode: '01',
  documentSerial: 'F001', documentNumber: '1', issueDate: '2026-11-10',
  items: [{ sku: 'SKU-1', quantity: 1, unitCost: 100 }],
} as never;

describe('PurchasesService - reglas COMPRA', () => {
  it('rechaza compra sin reglas COMPRA', async () => {
    const prisma = { accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.createPurchase('c1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza compra con reglas incompletas', async () => {
    const prisma = { accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '601' }]) } };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.createPurchase('c1', dto)).rejects.toThrow('líneas 1 a 3');
  });

  it('no genera asiento si las reglas desaparecen al asentar', async () => {
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const accounting = { execute: jest.fn() };
    const service = new PurchasesService(prisma as never, accounting as never);
    await (service as any).registrarAsientoCompra('c1', {
      purchaseNumber: 'COM-1', documentSerial: 'F001', documentNumber: '1', supplierName: 'Proveedor',
      netAmount: 100, igvAmount: 18, totalAmount: 118,
    }, new Date('2026-11-10'));
    expect(accounting.execute).not.toHaveBeenCalled();
  });

  it('informa el motivo cuando no puede contabilizar la compra', async () => {
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);

    const resultado = await (service as any).registrarAsientoCompra('c1', {
      purchaseNumber: 'COM-2', documentSerial: 'F001', documentNumber: '2', supplierName: 'Proveedor',
      netAmount: 100, igvAmount: 18, totalAmount: 118,
    }, new Date('2026-11-10'));

    expect(resultado).toEqual({
      asientoGenerado: false,
      motivo: 'reglas COMPRA incompletas: se requieren las líneas 1 a 3',
    });
  });

  it('informa el motivo cuando el asiento falla, sin romper la compra', async () => {
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([
        { line_order: 1, account_code: '60111' },
        { line_order: 2, account_code: '40111' },
        { line_order: 3, account_code: '42121' },
      ]) },
    };
    const accounting = { execute: jest.fn().mockRejectedValue(new Error('cuenta inexistente')) };
    const service = new PurchasesService(prisma as never, accounting as never);

    const resultado = await (service as any).registrarAsientoCompra('c1', {
      purchaseNumber: 'COM-3', documentSerial: 'F001', documentNumber: '3', supplierName: 'Proveedor',
      netAmount: 100, igvAmount: 18, totalAmount: 118,
    }, new Date('2026-11-10'));

    expect(resultado.asientoGenerado).toBe(false);
    expect(resultado.motivo).toContain('cuenta inexistente');
  });

  it('no reasienta una compra que ya tiene asiento', async () => {
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      accountingRule: { findMany: jest.fn() },
    };
    const accounting = { execute: jest.fn() };
    const service = new PurchasesService(prisma as never, accounting as never);

    const resultado = await (service as any).registrarAsientoCompra('c1', {
      purchaseNumber: 'COM-4', documentSerial: 'F001', documentNumber: '4', supplierName: 'Proveedor',
      netAmount: 100, igvAmount: 18, totalAmount: 118,
    }, new Date('2026-11-10'));

    expect(resultado).toEqual({ asientoGenerado: true });
    expect(accounting.execute).not.toHaveBeenCalled();
  });

  describe('postAccounting', () => {
    const compraDb = () => ({
      id: 'p1',
      purchase_number: 'COM-000001',
      document_serial: 'F001',
      document_number: '77',
      supplier_name: 'Proveedor SAC',
      issue_date: new Date('2026-11-08T00:00:00Z'),
      status: 'REGISTRADA',
      net_amount: 200,
      igv_amount: 36,
      total_amount: 236,
      currency_code: 'PEN',
      items: [],
    });

    it('reintenta el asiento de una compra sin contabilizar', async () => {
      const prisma = {
        nationalPurchase: { findFirst: jest.fn().mockResolvedValue(compraDb()) },
        accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
        accountingRule: { findMany: jest.fn().mockResolvedValue([
          { line_order: 1, account_code: '60111' },
          { line_order: 2, account_code: '40111' },
          { line_order: 3, account_code: '42121' },
        ]) },
      };
      const accounting = { execute: jest.fn().mockResolvedValue({}) };
      const service = new PurchasesService(prisma as never, accounting as never);

      const r = await service.postAccounting('c1', 'p1');

      expect(r.asientoGenerado).toBe(true);
      expect(r.yaExistia).toBe(false);
      expect(accounting.execute).toHaveBeenCalledTimes(1);
    });

    it('no duplica el asiento si la compra ya lo tiene', async () => {
      const prisma = {
        nationalPurchase: { findFirst: jest.fn().mockResolvedValue(compraDb()) },
        accountingEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
        accountingRule: { findMany: jest.fn() },
      };
      const accounting = { execute: jest.fn() };
      const service = new PurchasesService(prisma as never, accounting as never);

      await expect(service.postAccounting('c1', 'p1')).resolves.toMatchObject({
        asientoGenerado: true,
        yaExistia: true,
      });
      expect(accounting.execute).not.toHaveBeenCalled();
    });

    it('rechaza una compra inexistente o anulada', async () => {
      const prisma = { nationalPurchase: { findFirst: jest.fn().mockResolvedValue(null) } };
      await expect(
        new PurchasesService(prisma as never, { execute: jest.fn() } as never).postAccounting('c1', 'no'),
      ).rejects.toThrow('Compra no encontrada');

      prisma.nationalPurchase.findFirst.mockResolvedValue({ ...compraDb(), status: 'ANULADA' });
      await expect(
        new PurchasesService(prisma as never, { execute: jest.fn() } as never).postAccounting('c1', 'p1'),
      ).rejects.toThrow('anulada');
    });

    it('informa el motivo cuando no puede contabilizar', async () => {
      const prisma = {
        nationalPurchase: { findFirst: jest.fn().mockResolvedValue(compraDb()) },
        accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
        accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);

      const r = await service.postAccounting('c1', 'p1');

      expect(r.asientoGenerado).toBe(false);
      expect(r.motivo).toContain('reglas COMPRA incompletas');
    });
  });
});
