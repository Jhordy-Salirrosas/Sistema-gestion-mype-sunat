import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryPurchaseService } from '../../../src/modules/inventory/application/services/inventoryPurchaseService';

describe('InventoryPurchaseService (Compras Nacionales - Operación 02)', () => {
  let service: InventoryPurchaseService;
  let mockPrisma: any;

  const companyId = 'comp-100';

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      inventoryWarehouse: {
        findFirst: jest.fn(),
      },
      nationalPurchase: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      treasuryMovement: { create: jest.fn(), findMany: jest.fn() },
      company: { findUnique: jest.fn().mockResolvedValue({ inventory_cost_method: 'PROMEDIO' }) },
      accountingRule: { findMany: jest.fn(({ where }: any) => Promise.resolve(where?.process_code === 'PAGO' ? [{ line_order: 1, account_code: '421' }, { line_order: 2, account_code: '1041' }] : [{ line_order: 1, account_code: '601' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '421' }, { line_order: 4, account_code: '201' }, { line_order: 5, account_code: '611' }])) },
      inventoryCostLayer: { create: jest.fn().mockResolvedValue({}) },
      accountingMapping: { findMany: jest.fn().mockResolvedValue([]) },
      businessPartner: {
        findFirst: jest.fn(),
      },
      inventoryProduct: {
        findFirst: jest.fn(),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };

    service = new InventoryPurchaseService(mockPrisma);
  });

  it('debe registrar una compra nacional con éxito, calcular IGV 18% y generar entradas al Kardex con operación 02', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({
      id: 'wh-1',
      company_id: companyId,
      warehouse_code: 'ALM-01',
    });

    mockPrisma.nationalPurchase.findFirst.mockResolvedValue(null); // No duplicado

    mockPrisma.businessPartner.findFirst.mockResolvedValue({
      id: 'partner-1',
      doc_number: '20100000001',
    });

    mockPrisma.inventoryProduct.findFirst
      .mockResolvedValueOnce({
        id: 'prod-1',
        sku: 'CEM-001',
        description: 'Cemento Sol',
        is_inventory: true,
        sunat_unit_code: 'NIU',
      })
      .mockResolvedValueOnce({
        id: 'prod-2',
        sku: 'ARE-001',
        description: 'Arena Gruesa',
        is_inventory: true,
        sunat_unit_code: 'NIU',
      });

    mockPrisma.inventoryBalance.findUnique
      .mockResolvedValueOnce({
        current_stock: 10,
        average_unit_cost: 25.0,
        total_inventory_value: 250.0,
      })
      .mockResolvedValueOnce(null); // Saldo inicial cero para el segundo

    mockPrisma.nationalPurchase.create.mockImplementation((args: any) => ({
      id: 'purch-1',
      purchase_number: args.data.purchase_number,
      supplier_doc_number: args.data.supplier_doc_number,
      supplier_name: args.data.supplier_name,
      document_type_code: args.data.document_type_code,
      document_serial: args.data.document_serial,
      document_number: args.data.document_number,
      issue_date: args.data.issue_date,
      warehouse_code: args.data.warehouse_code,
      net_amount: args.data.net_amount,
      igv_amount: args.data.igv_amount,
      total_amount: args.data.total_amount,
      status: args.data.status,
      items: args.data.items.create.map((item: any, idx: number) => ({
        id: `item-${idx + 1}`,
        ...item,
      })),
    }));

    mockPrisma.company.findUnique.mockResolvedValue({ inventory_cost_method: 'FIFO' });

    const result = await service.createPurchase(companyId, {
      supplierDocNumber: '20100000001',
      supplierName: 'Distribuidora Lima S.A.C.',
      documentTypeCode: '01',
      documentSerial: 'F001',
      documentNumber: '0001234',
      issueDate: '2026-11-05T10:00:00Z',
      warehouseCode: 'ALM-01',
      items: [
        { sku: 'CEM-001', quantity: 20, unitCost: 30.0 }, // Subtotal: 600, IGV: 108, Total: 708
        { sku: 'ARE-001', quantity: 10, unitCost: 40.0 }, // Subtotal: 400, IGV: 72, Total: 472
      ],
    });

    // Verificación de totales calculados (Base imponible: 1000, IGV 18%: 180, Total CxP: 1180)
    expect(result.netAmount).toBe(1000.0);
    expect(result.igvAmount).toBe(180.0);
    expect(result.totalAmount).toBe(1180.0);
    expect(result.itemsCount).toBe(2);

    // Verificación de asientos Kardex generados
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.inventoryCostLayer.create).toHaveBeenCalledTimes(2);
    const mov1 = mockPrisma.inventoryMovement.create.mock.calls[0][0].data;
    expect(mov1.operation_type_code).toBe('02'); // Operación 02 SUNAT
    expect(mov1.direction).toBe('ENTRADA');
    expect(mov1.source_module).toBe('PURCHASES');
    expect(mov1.document_serial).toBe('F001');
    expect(mov1.document_number).toBe('0001234');
    expect(mov1.quantity).toBe(20);
    expect(mov1.unit_cost).toBe(30.0);
    // Stock previo 10 a 25 = 250. Entran 20 a 30 = 600. Total stock: 30. Costo promedio: 850 / 30 = 28.3333
    expect(mov1.resulting_stock).toBe(30);
    expect(mov1.resulting_unit_cost).toBe(28.3333);

    const mov2 = mockPrisma.inventoryMovement.create.mock.calls[1][0].data;
    expect(mov2.operation_type_code).toBe('02');
    expect(mov2.direction).toBe('ENTRADA');
    expect(mov2.resulting_stock).toBe(10);
    expect(mov2.resulting_unit_cost).toBe(40.0);

    // Verificación de saldos actualizados
    expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalledTimes(2);
  });

  it('debe lanzar ConflictException si la factura del proveedor ya fue registrada previamente', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({
      id: 'wh-1',
      warehouse_code: 'ALM-01',
    });

    mockPrisma.nationalPurchase.findFirst.mockResolvedValue({
      id: 'existing-id',
      document_serial: 'F001',
      document_number: '0001234',
    });

    await expect(
      service.createPurchase(companyId, {
        supplierDocNumber: '20100000001',
        supplierName: 'Distribuidora Lima S.A.C.',
        documentTypeCode: '01',
        documentSerial: 'F001',
        documentNumber: '0001234',
        issueDate: '2026-11-05T10:00:00Z',
        items: [{ sku: 'CEM-001', quantity: 5, unitCost: 30.0 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('debe rechazar la compra si un ítem corresponde a un servicio que no mueve stock', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({
      id: 'wh-1',
      warehouse_code: 'ALM-01',
    });
    mockPrisma.nationalPurchase.findFirst.mockResolvedValue(null);

    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'srv-1',
      sku: 'SRV-FLETE',
      description: 'Servicio de Flete',
      is_inventory: false, // Servicio
    });

    await expect(
      service.createPurchase(companyId, {
        supplierDocNumber: '20100000001',
        supplierName: 'Distribuidora Lima S.A.C.',
        documentTypeCode: '01',
        documentSerial: 'F001',
        documentNumber: '0005555',
        issueDate: '2026-11-05T10:00:00Z',
        items: [{ sku: 'SRV-FLETE', quantity: 1, unitCost: 150.0 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar la compra si se repite el mismo SKU en el detalle de la factura', async () => {
    await expect(
      service.createPurchase(companyId, {
        supplierDocNumber: '20100000001',
        supplierName: 'Distribuidora Lima S.A.C.',
        documentTypeCode: '01',
        documentSerial: 'F001',
        documentNumber: '0009999',
        issueDate: '2026-11-05T10:00:00Z',
        items: [
          { sku: 'CEM-001', quantity: 10, unitCost: 28.0 },
          { sku: 'CEM-001', quantity: 5, unitCost: 30.0 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('genera el asiento contable de la compra con inventario, IGV y CxP', async () => {
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    mockPrisma.accountingEntry = { findFirst: jest.fn().mockResolvedValue(null) };
    const conContabilidad = new InventoryPurchaseService(mockPrisma, accounting as any);

    await (conContabilidad as any).registrarAsientoCompra(
      companyId,
      {
        purchaseNumber: 'COM-00000001',
        documentSerial: 'F001',
        documentNumber: '00000001',
        supplierName: 'Proveedor SAC',
        netAmount: 100,
        igvAmount: 18,
        totalAmount: 118,
      },
      new Date('2026-11-05T00:00:00.000Z'),
    );

    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'PURCHASES',
      sourceReferenceId: 'COM-00000001',
      period: '2026-11',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '601', debitAmount: 100 }),
        expect.objectContaining({ accountCode: '40111', debitAmount: 18 }),
        expect.objectContaining({ accountCode: '421', creditAmount: 118 }),
        expect.objectContaining({ accountCode: '201', debitAmount: 100 }),
        expect.objectContaining({ accountCode: '611', creditAmount: 100 }),
      ]),
    }));
  });

  it('aplica mapeador dinámico de cuentas PCGE (60111, 42121, 20111, 61111) cuando existe configuración', async () => {
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    mockPrisma.accountingEntry = { findFirst: jest.fn().mockResolvedValue(null) };
    mockPrisma.accountingRule.findMany.mockResolvedValue([
      { line_order: 1, account_code: '60111' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '42121' }, { line_order: 4, account_code: '20111' }, { line_order: 5, account_code: '61111' },
    ]);
    mockPrisma.accountingMapping = {
      findMany: jest.fn().mockResolvedValue([
        { role_code: 'GASTO_COMPRA', account_code: '60111' },
        { role_code: 'IGV_CREDITO', account_code: '40111' },
        { role_code: 'CXP', account_code: '42121' },
        { role_code: 'DESTINO_INVENTARIO', account_code: '20111' },
        { role_code: 'VARIACION_EXISTENCIA', account_code: '61111' },
      ]),
    };
    const conContabilidad = new InventoryPurchaseService(mockPrisma, accounting as any);

    await (conContabilidad as any).registrarAsientoCompra(
      companyId,
      {
        purchaseNumber: 'COM-00000002',
        documentSerial: 'F001',
        documentNumber: '00000002',
        supplierName: 'Distribuidora Lima SAC',
        netAmount: 500,
        igvAmount: 90,
        totalAmount: 590,
      },
      new Date('2026-11-05T00:00:00.000Z'),
    );

    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'PURCHASES',
      sourceReferenceId: 'COM-00000002',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '60111', debitAmount: 500 }),
        expect.objectContaining({ accountCode: '40111', debitAmount: 90 }),
        expect.objectContaining({ accountCode: '42121', creditAmount: 590 }),
        expect.objectContaining({ accountCode: '20111', debitAmount: 500 }),
        expect.objectContaining({ accountCode: '61111', creditAmount: 500 }),
      ]),
    }));
  });

  it('registra el pago de una compra con asiento CxP contra banco', async () => {
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const serviceConPago = new InventoryPurchaseService(mockPrisma, accounting as never);
    mockPrisma.nationalPurchase.findFirst.mockResolvedValue({
      id: 'p1', company_id: companyId, purchase_number: 'COM-1', status: 'REGISTRADA',
      supplier_name: 'Proveedor', document_serial: 'F001', document_number: '1', total_amount: 118,
    });
    mockPrisma.nationalPurchase.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.create.mockResolvedValue({ id: 'mov-1' });
    await expect(serviceConPago.payPurchase(companyId, 'p1', { paymentMethod: 'TRANSFERENCIA' })).resolves.toMatchObject({ status: 'PAGADA', amount: 118 });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceReferenceId: 'PAGO-COM-1-mov-1',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '421', debitAmount: 118 }),
        expect.objectContaining({ accountCode: '1041', creditAmount: 118 }),
      ]),
    }));
  });


  it('lista el historial de pagos de una compra', async () => {
    mockPrisma.nationalPurchase.findFirst.mockResolvedValue({ purchase_number: 'COM-1' });
    mockPrisma.treasuryMovement.findMany.mockResolvedValue([{ id: 'm1', movement_date: new Date('2026-11-09'), amount: 50, payment_method: 'TRANSFERENCIA', bank_name: 'BCP', concept: 'Pago parcial' }]);
    await expect(service.listPayments(companyId, 'p1')).resolves.toEqual([{ id: 'm1', date: new Date('2026-11-09'), amount: 50, paymentMethod: 'TRANSFERENCIA', bankName: 'BCP', concept: 'Pago parcial' }]);
  });

  it('registra un pago parcial y deja saldo pendiente', async () => {
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const serviceConPago = new InventoryPurchaseService(mockPrisma, accounting as never);
    mockPrisma.nationalPurchase.findFirst.mockResolvedValue({
      id: 'p2', company_id: companyId, purchase_number: 'COM-2', status: 'REGISTRADA',
      supplier_name: 'Proveedor', document_serial: 'F001', document_number: '2', total_amount: 118, paid_amount: 0,
    });
    mockPrisma.nationalPurchase.update.mockResolvedValue({});
    mockPrisma.treasuryMovement.create.mockResolvedValue({ id: 'mov-1' });
    await expect(serviceConPago.payPurchase(companyId, 'p2', { amount: 50 })).resolves.toMatchObject({ status: 'PAGO_PARCIAL', paidAmount: 50, balance: 68 });
    expect(mockPrisma.nationalPurchase.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { status: 'PAGO_PARCIAL', paid_amount: 50 } });
  });

  it('consolida cuentas por pagar por proveedor', async () => {
    mockPrisma.nationalPurchase.findMany.mockResolvedValue([
      { supplier_doc_number: '20100000001', supplier_name: 'Proveedor', total_amount: 118, paid_amount: 50 },
      { supplier_doc_number: '20100000001', supplier_name: 'Proveedor', total_amount: 100, paid_amount: 0 },
    ]);
    const r = await service.listPayables(companyId);
    expect(r).toEqual([{ supplierDocNumber: '20100000001', supplierName: 'Proveedor', total: 218, paid: 50, balance: 168, count: 2 }]);
  });
});
