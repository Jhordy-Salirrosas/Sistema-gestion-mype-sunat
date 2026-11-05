import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
      },
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
});

