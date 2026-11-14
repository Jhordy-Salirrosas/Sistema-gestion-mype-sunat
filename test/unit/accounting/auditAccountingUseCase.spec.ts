import { AuditAccountingUseCase } from '../../../src/modules/accounting/application/use-cases/auditAccountingUseCase';

const CATALOGO_DB = [
  { code: '10', name: 'Efectivo', parent_code: null, is_active: true },
  { code: '101', name: 'Caja', parent_code: '10', is_active: true },
  { code: '1011', name: 'Caja principal', parent_code: '101', is_active: true },
  { code: '1041', name: 'Cuenta corriente', parent_code: '104', is_active: true },
  { code: '12121', name: 'Facturas por cobrar', parent_code: '1212', is_active: true },
  { code: '40111', name: 'IGV cuenta propia', parent_code: '4011', is_active: true },
  { code: '42121', name: 'Facturas por pagar', parent_code: '4212', is_active: true },
  { code: '60111', name: 'Compras', parent_code: '6011', is_active: true },
  { code: '70121', name: 'Ventas gravadas', parent_code: '7012', is_active: true },
];

const REGLAS_DB = [
  { process_code: 'PAGO', document_type: '*', line_order: 1, account_code: '42121', side: 'DEBE', is_active: true },
  { process_code: 'PAGO', document_type: '*', line_order: 2, account_code: '1041', side: 'HABER', is_active: true },
];

/** Asiento balanceado de ejemplo: 100 al debe contra 100 al haber. */
const asiento = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  entry_number: 1,
  period: '2026-11',
  source_module: 'M1_INVOICES',
  source_reference_id: 'inv-1',
  total_debit: 100,
  total_credit: 100,
  status: 'ASENTADO',
  lines: [
    { account_code: '12121', debit_amount: 100, credit_amount: 0 },
    { account_code: '70121', debit_amount: 0, credit_amount: 100 },
  ],
  ...over,
});

const comprobante = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  serie: 'F001',
  correlativo: 1,
  tipo_comprobante: '01',
  fecha_emision: new Date('2026-11-10T00:00:00Z'),
  monto_total: 100,
  ...over,
});

const crearPrisma = (over: Record<string, any> = {}) => ({
  accountingAccount: { findMany: jest.fn().mockResolvedValue(CATALOGO_DB) },
  accountingRule: { findMany: jest.fn().mockResolvedValue(REGLAS_DB) },
  accountingEntry: { findMany: jest.fn().mockResolvedValue([]) },
  invoice: { findMany: jest.fn().mockResolvedValue([]) },
  inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
  nationalPurchase: { findMany: jest.fn().mockResolvedValue([]) },
  collection: { findMany: jest.fn().mockResolvedValue([]) },
  accountingMapping: { findMany: jest.fn().mockResolvedValue([]) },
  ...over,
});

describe('AuditAccountingUseCase', () => {
  it('informa ok cuando las reglas son válidas y los asientos cuadran', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany
      .mockResolvedValueOnce([asiento()])
      .mockResolvedValueOnce([{ source_reference_id: 'inv-1', idempotency_key: 'm1:invoice:inv-1' }]);
    prisma.invoice.findMany.mockResolvedValue([comprobante()]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1', '2026-11');

    expect(reporte.ok).toBe(true);
    expect(reporte.resumen).toEqual({ errors: 0, warnings: 0 });
    expect(reporte.asientos.revisados).toBe(1);
    expect(reporte.comprobantes.sinAsiento).toHaveLength(0);
    expect(reporte.period).toBe('2026-11');
  });

  it('detecta un asiento descuadrado con el importe de la diferencia', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([
      asiento({ lines: [{ account_code: '12121', debit_amount: 100, credit_amount: 0 }, { account_code: '70121', debit_amount: 0, credit_amount: 90 }] }),
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.descuadrados).toHaveLength(1);
    expect(reporte.asientos.descuadrados[0].diferencia).toBe(10);
    expect(reporte.ok).toBe(false);
  });

  it('detecta un asiento con menos de dos líneas', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([
      asiento({ lines: [{ account_code: '12121', debit_amount: 100, credit_amount: 0 }] }),
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.sinLineas).toHaveLength(1);
    expect(reporte.asientos.descuadrados).toHaveLength(0);
  });

  it('detecta totales persistidos que no coinciden con las líneas', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([asiento({ total_debit: 50, total_credit: 50 })]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.descuadrados[0].detalle).toContain('no coinciden');
  });

  it('detecta asientos duplicados para la misma referencia de origen', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([
      asiento({ id: 'e1' }),
      asiento({ id: 'e2', entry_number: 2 }),
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.duplicados).toHaveLength(1);
    expect(reporte.asientos.duplicados[0]).toMatchObject({
      sourceModule: 'M1_INVOICES',
      sourceReferenceId: 'inv-1',
      asientos: 2,
    });
  });

  it('no cuenta como duplicado un asiento anulado', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([
      asiento({ id: 'e1' }),
      asiento({ id: 'e2', status: 'ANULADO' }),
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.duplicados).toHaveLength(0);
  });

  it('detecta líneas que usan una cuenta de mayor con subcuentas', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([
      asiento({ lines: [{ account_code: '101', debit_amount: 100, credit_amount: 0 }, { account_code: '70121', debit_amount: 0, credit_amount: 100 }] }),
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.asientos.conCuentaInvalida).toHaveLength(1);
    expect(reporte.asientos.conCuentaInvalida[0].issues[0].code).toBe('CUENTA_MADRE');
  });

  it('lista los comprobantes aceptados sin asiento', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.invoice.findMany.mockResolvedValue([comprobante({ id: 'inv-9', correlativo: 9 })]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.comprobantes.sinAsiento).toHaveLength(1);
    expect(reporte.comprobantes.sinAsiento[0].numero).toBe('F001-00000009');
    expect(reporte.comprobantes.sinAsiento[0].detalle).toContain('sin asiento');
  });

  it('detecta una venta con inventario valorizado pero sin asiento de costo', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ source_reference_id: 'inv-1', idempotency_key: 'm1:invoice:inv-1' }]);
    prisma.invoice.findMany.mockResolvedValue([comprobante()]);
    prisma.inventoryMovement.findMany.mockResolvedValue([
      { source_reference_id: 'F001-00000001', total_cost: 62.5 },
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.comprobantes.sinAsiento).toHaveLength(0);
    expect(reporte.comprobantes.sinCosto).toHaveLength(1);
    expect(reporte.comprobantes.sinCosto[0].detalle).toContain('62.50');
  });

  it('no reporta falta de costo cuando el asiento de costo ya existe', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { source_reference_id: 'inv-1', idempotency_key: 'm1:invoice:inv-1' },
        { source_reference_id: 'inv-1:COSTO', idempotency_key: 'm1:invoice-cost:inv-1' },
      ]);
    prisma.invoice.findMany.mockResolvedValue([comprobante()]);
    prisma.inventoryMovement.findMany.mockResolvedValue([
      { source_reference_id: 'F001-00000001', total_cost: 62.5 },
    ]);

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.comprobantes.sinCosto).toHaveLength(0);
  });

  it('reporta catálogo vacío como error de configuración', async () => {
    const prisma = crearPrisma({ accountingAccount: { findMany: jest.fn().mockResolvedValue([]) } });

    const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

    expect(reporte.ok).toBe(false);
    expect(reporte.reglas.issues[0].code).toBe('CATALOGO_VACIO');
    expect(reporte.catalogo.total).toBe(0);
  });

  it('acota asientos y comprobantes al período indicado', async () => {
    const prisma = crearPrisma();
    await new AuditAccountingUseCase(prisma as never).execute('c1', '2026-11');

    expect(prisma.accountingEntry.findMany.mock.calls[0][0].where).toMatchObject({
      company_id: 'c1',
      period: '2026-11',
    });
    const whereFacturas = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(whereFacturas.fecha_emision.gte).toEqual(new Date(Date.UTC(2026, 10, 1, 5, 0, 0)));
    expect(whereFacturas.fecha_emision.lt).toEqual(new Date(Date.UTC(2026, 11, 1, 5, 0, 0)));
  });

  it('rechaza un período con formato inválido en lugar de devolver un falso "todo limpio"', async () => {
    const prisma = crearPrisma();
    await expect(
      new AuditAccountingUseCase(prisma as never).execute('c1', 'noviembre'),
    ).rejects.toThrow('El período debe tener formato YYYY-MM');
    expect(prisma.accountingEntry.findMany).not.toHaveBeenCalled();
  });

  describe('compras sin asiento', () => {
    const compra = (over: Record<string, unknown> = {}) => ({
      id: 'p1',
      purchase_number: 'COM-000001',
      document_serial: 'F001',
      document_number: '77',
      supplier_name: 'Proveedor SAC',
      total_amount: 236,
      issue_date: new Date('2026-11-08T00:00:00Z'),
      ...over,
    });

    it('lista las compras registradas sin asiento', async () => {
      const prisma = crearPrisma();
      prisma.accountingEntry.findMany
        .mockResolvedValueOnce([]) // asientos del período
        .mockResolvedValueOnce([]) // asientos de comprobantes
        .mockResolvedValueOnce([]); // asientos de compras
      prisma.nationalPurchase.findMany.mockResolvedValue([compra()]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1', '2026-11');

      expect(reporte.compras.sinAsiento).toHaveLength(1);
      expect(reporte.compras.sinAsiento[0]).toMatchObject({
        numero: 'COM-000001',
        documento: 'F001-77',
        proveedor: 'Proveedor SAC',
        total: 236,
      });
    });

    it('no reporta la compra cuando su asiento ya existe', async () => {
      const prisma = crearPrisma();
      // Sin comprobantes de venta no se consulta su asiento: la segunda
      // llamada es la de compras.
      prisma.accountingEntry.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ source_reference_id: 'COM-000001' }]);
      prisma.nationalPurchase.findMany.mockResolvedValue([compra()]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

      expect(reporte.compras.sinAsiento).toHaveLength(0);
    });

    it('no consulta asientos de compras cuando no hay compras', async () => {
      const prisma = crearPrisma();
      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');
      expect(reporte.compras.revisadas).toBe(0);
      expect(reporte.compras.sinAsiento).toEqual([]);
    });
  });

  describe('cobros de comprobantes anulados', () => {
    it('lista los cobros vivos de una venta anulada', async () => {
      const prisma = crearPrisma();
      prisma.invoice.findMany
        .mockResolvedValueOnce([]) // comprobantes aceptados
        .mockResolvedValueOnce([{ id: 'inv-anulada', serie: 'F001', correlativo: 5 }]);
      prisma.collection.findMany.mockResolvedValue([{
        id: 'cob-1',
        invoice_id: 'inv-anulada',
        invoice_number: 'F001-00000005',
        customer_name: 'Cliente SAC',
        amount: 118,
        collection_date: new Date('2026-11-09T00:00:00Z'),
      }]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

      expect(reporte.cobros.deComprobantesAnulados).toHaveLength(1);
      expect(reporte.cobros.deComprobantesAnulados[0]).toMatchObject({
        comprobante: 'F001-00000005',
        cliente: 'Cliente SAC',
        monto: 118,
      });
    });

    it('no consulta cobros cuando no hay comprobantes anulados', async () => {
      const prisma = crearPrisma();
      await new AuditAccountingUseCase(prisma as never).execute('c1');
      expect(prisma.collection.findMany).not.toHaveBeenCalled();
    });
  });

  describe('mapeos contables', () => {
    it('detecta un mapeo con cuenta inexistente', async () => {
      const prisma = crearPrisma();
      prisma.accountingMapping.findMany.mockResolvedValue([
        { process_code: 'COMPRA', role_code: 'VARIACION_EXISTENCIA', account_code: '61111', is_active: true },
      ]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

      expect(reporte.mapeos.total).toBe(1);
      expect(reporte.mapeos.issues[0].code).toBe('CUENTA_NO_EXISTE');
      expect(reporte.mapeos.issues[0].message).toContain('COMPRA/VARIACION_EXISTENCIA');
    });

    it('detecta un mapeo con cuenta de mayor', async () => {
      const prisma = crearPrisma();
      prisma.accountingMapping.findMany.mockResolvedValue([
        { process_code: 'VENTA', role_code: 'INVENTARIO', account_code: '101', is_active: true },
      ]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

      expect(reporte.mapeos.issues[0].code).toBe('CUENTA_MADRE');
    });

    it('no reporta mapeos correctos ni inactivos', async () => {
      const prisma = crearPrisma();
      prisma.accountingMapping.findMany.mockResolvedValue([
        { process_code: 'VENTA', role_code: 'CXC', account_code: '12121', is_active: true },
        { process_code: 'VENTA', role_code: 'VIEJO', account_code: '99999', is_active: false },
      ]);

      const reporte = await new AuditAccountingUseCase(prisma as never).execute('c1');

      expect(reporte.mapeos.issues).toEqual([]);
    });
  });
});
