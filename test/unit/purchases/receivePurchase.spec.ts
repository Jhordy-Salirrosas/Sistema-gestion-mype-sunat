import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

const item = (over: Record<string, any> = {}) => ({
  id: 'i1', product_id: 'prod1', sku: 'SKU1', description: 'Producto', quantity: 10, received_quantity: 0, unit_cost: 5,
  ...over,
});
const compra = (over: Record<string, any> = {}) => ({
  id: 'p1', company_id: 'c1', purchase_number: 'COM-1', supplier_doc_number: '20100070970', supplier_name: 'Proveedor',
  document_type_code: '01', document_serial: 'F001', document_number: '1', issue_date: new Date('2026-11-13'),
  warehouse_code: 'ALM-01', net_amount: 50, igv_amount: 9, total_amount: 59, paid_amount: 0, status: 'REGISTRADA',
  reception_status: 'PENDIENTE', items: [item()], ...over,
});

function setup(initial = compra(), updated = compra({ reception_status: 'PARCIAL', items: [item({ received_quantity: 4 })] })) {
  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
    accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    accountingRule: { findMany: jest.fn(({ where }: any) => Promise.resolve(
      where.process_code === 'RECEPCION'
        ? [{ line_order: 1, account_code: '20111' }, { line_order: 2, account_code: '611' }]
        : [{ line_order: 1, account_code: '601' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '421' }],
    )) },
    nationalPurchase: {
      findFirst: jest.fn().mockResolvedValue(initial),
      findUnique: jest.fn().mockResolvedValue(updated),
      update: jest.fn().mockResolvedValue(updated),
    },
    nationalPurchaseItem: { update: jest.fn().mockResolvedValue({}) },
    inventoryWarehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh1', warehouse_code: 'ALM-01' }) },
    inventoryProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'prod1', sku: 'SKU1', description: 'Producto' }) },
    inventoryBalance: {
      findUnique: jest.fn().mockResolvedValue({ current_stock: 10, average_unit_cost: 4, total_inventory_value: 40 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    inventoryCostLayer: { create: jest.fn().mockResolvedValue({}) },
    inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
  };
  const accounting = { execute: jest.fn().mockResolvedValue({}) };
  return { prisma, accounting, service: new PurchasesService(prisma as never, accounting as never) };
}

describe('PurchasesService - recepción de mercadería', () => {
  it('recibe parcialmente, mueve Kardex y genera asiento de recepción', async () => {
    const { prisma, accounting, service } = setup();
    const result = await service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 4 }] });

    expect(result.receptionStatus).toBe('PARCIAL');
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: 'ENTRADA', operation_type_code: '02', source_module: 'PURCHASES_RECEPTION', quantity: 4 }),
    }));
    expect(prisma.inventoryCostLayer.create).toHaveBeenCalled();
    expect(prisma.inventoryBalance.upsert).toHaveBeenCalled();
    expect(prisma.nationalPurchaseItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { received_quantity: { increment: 4 } } });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'PURCHASES_RECEPTION',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '20111', debitAmount: 20 }),
        expect.objectContaining({ accountCode: '611', creditAmount: 20 }),
      ]),
    }));
  });

  it('rechaza compra inexistente, anulada o ya recibida', async () => {
    const noExiste = setup(compra(), compra());
    noExiste.prisma.nationalPurchase.findFirst.mockResolvedValue(null);
    await expect(noExiste.service.receivePurchase('c1', 'p1', {})).rejects.toBeInstanceOf(NotFoundException);

    const anulada = setup(compra({ status: 'ANULADA' }));
    await expect(anulada.service.receivePurchase('c1', 'p1', {})).rejects.toThrow('anulada');

    const recibida = setup(compra({ reception_status: 'RECIBIDA' }));
    await expect(recibida.service.receivePurchase('c1', 'p1', {})).rejects.toThrow('recibida');
  });

  it('rechaza sin pendientes, ítem inválido o cantidad excedida', async () => {
    const sinPendientes = setup(compra({ items: [item({ received_quantity: 10 })] }));
    await expect(sinPendientes.service.receivePurchase('c1', 'p1', {})).rejects.toThrow('pendientes');

    const itemInvalido = setup();
    await expect(itemInvalido.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'no-existe', quantity: 1 }] })).rejects.toThrow('inválido');

    const excedido = setup();
    await expect(excedido.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 11 }] })).rejects.toThrow('Cantidad inválida');

    const cero = setup();
    await expect(cero.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 0 }] })).rejects.toThrow('Cantidad inválida');
  });

  it('recibe todo y marca RECIBIDA', async () => {
    const { service } = setup(compra(), compra({ reception_status: 'RECIBIDA', items: [item({ received_quantity: 10 })] }));
    const result = await service.receivePurchase('c1', 'p1', {});
    expect(result.receptionStatus).toBe('RECIBIDA');
  });

  it('no registra asiento si no hay importe o el servicio no tiene contabilidad', async () => {
    const { prisma } = setup();
    const serviceSinContabilidad = new PurchasesService(prisma as never);
    await expect(serviceSinContabilidad.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 1 }] })).resolves.toMatchObject({ id: 'p1' });
  });

  it('rechaza almacén o producto inexistente', async () => {
    const sinAlmacen = setup();
    sinAlmacen.prisma.inventoryWarehouse.findFirst.mockResolvedValue(null);
    await expect(sinAlmacen.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 1 }] })).rejects.toBeInstanceOf(NotFoundException);

    const sinProducto = setup();
    sinProducto.prisma.inventoryProduct.findUnique.mockResolvedValue(null);
    await expect(sinProducto.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 1 }] })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no genera asiento si faltan reglas RECEPCION o contabilidad falla', async () => {
    const sinReglas = setup();
    sinReglas.prisma.accountingRule.findMany.mockResolvedValue([]);
    await expect(sinReglas.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 1 }] })).resolves.toMatchObject({ id: 'p1' });
    expect(sinReglas.accounting.execute).not.toHaveBeenCalled();

    const falla = setup();
    falla.accounting.execute.mockRejectedValue(new Error('periodo cerrado'));
    await expect(falla.service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 1 }] })).resolves.toMatchObject({ id: 'p1' });
  });

  it('acepta fecha de recepción explícita y calcula costo', async () => {
    const { prisma, service } = setup();
    await service.receivePurchase('c1', 'p1', { items: [{ itemId: 'i1', quantity: 2 }], receivedAt: '2026-11-10T12:00:00.000Z' });
    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ movement_date: new Date('2026-11-10T12:00:00.000Z') }) }));
  });
});
