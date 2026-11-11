import { InvoiceBridgeCoordinatorService } from '../../../src/modules/invoices/application/services/invoiceBridgeCoordinatorService';
import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { InventoryCostLayerService } from '../../../src/modules/inventory/application/services/inventoryCostLayerService';
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InvoiceBridgeReprocessController } from '../../../src/modules/invoices/infrastructure/controllers/invoiceBridgeReprocessController';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';

function escenario(capa = true) {
  const movimientos: any[] = [];
  const entries: any[] = [
    {
      id: 'venta-039',
      company_id: 'empresa',
      source_reference_id: 'F001-00000064',
      source_module: 'M1_INVOICES',
    },
  ];
  const capas: any[] = capa
    ? [{ id: 'capa', quantity_remaining: 1, unit_cost: 15 }]
    : [];
  let balance: any = {
    currentStock: 1,
    averageUnitCost: 15,
    totalInventoryValue: 15,
  };
  const fila = {
    id: 'inv-64',
    company_id: 'empresa',
    estado: InvoiceStatus.ACEPTADO,
    tipo_comprobante: '01',
    serie: 'F001',
    correlativo: 64,
    fecha_emision: new Date('2026-11-10'),
    payload_ubl: {
      almacen: 'ALM-02',
      montoTotal: 35.4,
      montoIgv: 5.4,
      montoGravado: 30,
      lineasTributarias: [{ afectacion: '10', valorVenta: 30, igv: 5.4 }],
    },
    items: [
      {
        item_code: 'CEM-001',
        description: 'Cemento',
        unit_code: 'NIU',
        quantity: 1,
        unit_value: 30,
        igv_affectation_type: '10',
      },
    ],
  };
  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, value]) =>
      key === 'OR'
        ? (value as any[]).some((w) => matches(row, w))
        : row[key] === value,
    );
  const prisma = {
    invoice: {
      findFirst: jest.fn(async ({ where }) =>
        matches(fila, where) ? fila : null,
      ),
      findUnique: jest.fn(async () => fila),
    },
    company: { findUnique: async () => ({ inventory_cost_method: 'FIFO' }) },
    inventoryProduct: { findFirst: async () => ({ id: 'p', sku: 'CEM-001' }) },
    inventoryMovement: {
      findFirst: async () => movimientos[0] ?? null,
      findMany: async () =>
        movimientos.map((m) => ({
          quantity: m.quantity,
          previous_unit_cost: m.previousUnitCost, total_cost: m.totalCost,
        })),
    },
    inventoryCostLayer: {
      findMany: jest.fn(async () =>
        capas.filter((c) => c.quantity_remaining > 0),
      ),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          capas.find((c) => c.id === where.id),
          data,
        ),
      ),
    },
    accountingEntry: {
      findFirst: jest.fn(
        async ({ where }) => entries.find((e) => matches(e, where)) ?? null,
      ),
    },
  };
  Object.assign(prisma, { $executeRaw: jest.fn(), $transaction: async (work: any) => work(prisma) });
  const createMovement = jest.fn(async (m: any) => {
    movimientos.push(m);
    return { ...m, id: 'mov-64' };
  });
  const findWarehouse = jest.fn(async () => ({
    id: 'w2',
    warehouseCode: 'ALM-02',
  }));
  const balances = {
    findByWarehouseAndProduct: jest.fn(async () => balance),
    upsertBalance: jest.fn(async (b) => {
      balance = b;
    }),
  };
  const movimiento = new RegisterManualMovementUseCase(
    { findByCode: findWarehouse } as never,
    { findBySku: async () => ({ id: 'p', sku: 'CEM-001' }) } as never,
    balances as never,
    { create: createMovement } as never,
    new InventoryCostLayerService(prisma as never),
  );
  const crearAsiento = jest.fn(async (dto: any) => {
    const entry = {
      id: 'costo-041',
      company_id: dto.companyId,
      source_reference_id: dto.sourceReferenceId,
      source_module: dto.sourceModule,
    };
    entries.push(entry);
    return entry;
  });
  const bridge = new InvoiceAccountingBridgeService(
    prisma as never,
    movimiento,
    { execute: crearAsiento } as never,
  );
  const fallback = { execute: jest.fn() };
  const servicio = new InvoiceBridgeCoordinatorService(
    prisma as never,
    bridge,
    fallback as never,
  );
  return {
    servicio,
    prisma,
    fila,
    capas,
    movimientos,
    entries,
    crearAsiento,
    createMovement,
    findWarehouse,
    balances,
    fallback,
  };
}

it('caso F001-64: recupera Kardex ALM-02 y costo S/15 conservando el asiento de venta', async () => {
  const h = escenario();
  const result = await h.servicio.reprocesar('empresa', 'inv-64');
  expect(result).toMatchObject({
    completo: true,
    yaCompleto: false,
    asientoId: 'venta-039',
    asientoOmitido: true,
    kardex: 'COMPLETO',
    asientoCostoId: 'costo-041',
    costoVenta: 15,
    errores: [],
  });
  expect(h.findWarehouse).toHaveBeenCalledWith('ALM-02', 'empresa');
  expect(h.balances.findByWarehouseAndProduct).toHaveBeenCalledWith(
    'w2',
    'p',
    'empresa',
  );
  expect(h.movimientos).toHaveLength(1);
  expect(h.movimientos[0]).toMatchObject({
    warehouseId: 'w2',
    previousUnitCost: 15,
  });
  expect(h.crearAsiento).toHaveBeenCalledTimes(1);
  expect(h.crearAsiento).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceReferenceId: 'inv-64:COSTO',
      lines: expect.arrayContaining([
        expect.objectContaining({ debitAmount: 15 }),
        expect.objectContaining({ creditAmount: 15 }),
      ]),
    }),
  );
  expect(h.capas[0].quantity_remaining).toBe(0);
  expect(h.fallback.execute).not.toHaveBeenCalled();
});
it('ya completo: segunda ejecución es no-op, sin asiento, movimiento, saldo ni consumo de capa adicionales', async () => {
  const h = escenario();
  await h.servicio.reprocesar('empresa', 'inv-64');
  const writes = [
    h.createMovement,
    h.crearAsiento,
    h.balances.upsertBalance,
    h.prisma.inventoryCostLayer.update,
  ];
  writes.forEach((spy) => spy.mockClear());
  expect(await h.servicio.reprocesar('empresa', 'inv-64')).toMatchObject({
    completo: true,
    yaCompleto: true,
    movimientosRegistrados: 0,
    asientoId: 'venta-039',
    asientoCostoId: 'costo-041',
  });
  writes.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  expect(h.capas[0].quantity_remaining).toBe(0);
});
it('sin capa FIFO devuelve pendiente y no crea movimiento/costo; con capa posterior el mismo comprobante se recupera', async () => {
  const h = escenario(false);
  expect(await h.servicio.reprocesar('empresa', 'inv-64')).toMatchObject({
    completo: false,
    yaCompleto: false,
    kardex: 'PENDIENTE',
    errores: [expect.stringContaining('Stock insuficiente para método FIFO')],
  });
  expect(h.createMovement).not.toHaveBeenCalled();
  expect(h.crearAsiento).not.toHaveBeenCalled();
  expect(h.prisma.inventoryCostLayer.update).not.toHaveBeenCalled();
  await expect(
    h.servicio.registrarComoTrabajo('inv-64', InvoiceStatus.ACEPTADO),
  ).rejects.toThrow('M1_KARDEX_PENDING');
  h.capas.push({ id: 'nueva', quantity_remaining: 1, unit_cost: 15 });
  expect(await h.servicio.reprocesar('empresa', 'inv-64')).toMatchObject({
    completo: true,
    costoVenta: 15,
  });
});
it.each([
  'PENDIENTE',
  'EN_COLA',
  'ERROR_RED',
  'ENVIADO',
  'RECHAZADO',
  'ANULADO',
])('rechaza %s antes de cargar o ejecutar el puente', async (estado) => {
  const h = escenario();
  h.fila.estado = estado as InvoiceStatus;
  await expect(h.servicio.reprocesar('empresa', 'inv-64')).rejects.toThrow(
    'ACEPTADO u OBSERVADO',
  );
  expect(h.prisma.invoice.findUnique).not.toHaveBeenCalled();
  expect(h.createMovement).not.toHaveBeenCalled();
});
it('acepta OBSERVADO y oculta comprobantes de otra empresa', async () => {
  const h = escenario();
  h.fila.estado = InvoiceStatus.OBSERVADO;
  await expect(h.servicio.reprocesar('otra', 'inv-64')).rejects.toMatchObject({
    status: 404,
  });
  expect(h.prisma.invoice.findUnique).not.toHaveBeenCalled();
  expect(await h.servicio.reprocesar('empresa', 'inv-64')).toMatchObject({
    completo: true,
  });
});
it('el controlador exige autenticación/ADMIN y toma la empresa del token, sin proveedores de envío', async () => {
  const h = escenario();
  const module = await Test.createTestingModule({
    controllers: [InvoiceBridgeReprocessController],
    providers: [
      { provide: InvoiceBridgeCoordinatorService, useValue: h.servicio },
      {
        provide: TOKEN_SERVICE_PORT,
        useValue: {
          verifyToken: (token: string) =>
            token === 'admin'
              ? { role: 'ADMIN', companyId: 'empresa' }
              : token === 'other'
                ? { role: 'ADMIN', companyId: 'otra' }
                : { role: 'CONTADOR', companyId: 'empresa' },
        },
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    const url = '/api/v1/invoices/inv-64/reprocesar-puente';
    await request(app.getHttpServer()).post(url).expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer contador')
      .expect(403);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer other')
      .expect(404);
    const result = await request(app.getHttpServer())
      .post(url)
      .set('Authorization', 'Bearer admin')
      .expect(200);
    expect(result.body).toMatchObject({ completo: true, costoVenta: 15 });
  } finally {
    await app.close();
  }
});

it('sin empresa autenticada no omite el filtro de tenant', async () => {
  const h = escenario();
  await expect(
    h.servicio.reprocesar(undefined as never, 'inv-64'),
  ).rejects.toMatchObject({ status: 403 });
  expect(h.prisma.invoice.findFirst).not.toHaveBeenCalled();
});
