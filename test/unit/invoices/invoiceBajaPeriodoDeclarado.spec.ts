import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';

/**
 * Regla de la tarea 4: un comprobante de un período ya declarado no se anula por
 * comunicación de baja; se corrige con nota de débito o de crédito.
 */
describe('vista previa RA: período declarado', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  const filas = () => [{
    id: 'inv-1',
    serie: 'F001',
    correlativo: 1,
    tipo_comprobante: '01',
    fecha_emision: new Date('2026-11-03T00:00:00.000Z'),
    estado: 'ACEPTADO',
    monto_total: 118,
    customer_identity_type: '6',
    customer_identity_number: '20100070970',
    total_igv: 18,
  }];

  const prismaCon = (extra: Record<string, unknown> = {}) => ({
    invoice: { findMany: jest.fn(async () => filas()) },
    company: { findUnique: jest.fn(async () => ({ ruc: '20601234567', legal_name: 'Empresa' })) },
    ...extra,
  });

  it('excluye la baja cuando el período contable está cerrado', async () => {
    const prisma = prismaCon({
      accountingPeriod: { findUnique: jest.fn(async () => ({ status: 'CERRADO' })) },
    });
    const vista = await new InvoiceSummaryService(prisma as never).vistaComunicacionBaja('empresa', '2026-11-03');
    expect(vista.lineas[0].incluido).toBe(false);
    expect(vista.lineas[0].motivoExclusion).toMatch(/cerrado o declarado en el PLE/);
  });

  it('excluye la baja cuando el libro del período ya se generó en el PLE', async () => {
    const prisma = prismaCon({
      accountingPeriod: { findUnique: jest.fn(async () => ({ status: 'ABIERTO' })) },
      pleBook: { findFirst: jest.fn(async () => ({ id: 'ple-1' })) },
    });
    const vista = await new InvoiceSummaryService(prisma as never).vistaComunicacionBaja('empresa', '2026-11-03');
    expect(vista.lineas[0].incluido).toBe(false);
    expect(vista.lineas[0].motivoExclusion).toMatch(/nota de débito o de crédito/);
  });

  it('permite la baja cuando el período está abierto y sin PLE', async () => {
    const prisma = prismaCon({
      accountingPeriod: { findUnique: jest.fn(async () => ({ status: 'ABIERTO' })) },
      pleBook: { findFirst: jest.fn(async () => null) },
    });
    const vista = await new InvoiceSummaryService(prisma as never).vistaComunicacionBaja('empresa', '2026-11-03');
    expect(vista.lineas[0].incluido).toBe(true);
  });

  it('no falla si el cliente Prisma no expone los modelos contables', async () => {
    const vista = await new InvoiceSummaryService(prismaCon() as never).vistaComunicacionBaja('empresa', '2026-11-03');
    expect(vista.lineas[0].incluido).toBe(true);
  });
});

describe('fusión M1/Contabilidad: tipo de nota y período declarado', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-03T12:00:00Z')); });
  afterEach(() => jest.useRealTimers());
  function setup(serie: string, situacion = 'ABIERTO') {
    const row = { id: 'nota', serie, correlativo: 1, tipo_comprobante: serie === 'BC01' ? '07' : '08',
      fecha_emision: new Date('2026-11-03'), estado: 'ACEPTADO', monto_total: 118, total_igv: 18,
      ruc_emisor: '20601234567', referenced_document_type: '03', referenced_series_correlative: 'B001-1',
      customer_identity_type: '6', customer_identity_number: '20100070970',
      history: [{ estado_nuevo: 'ACEPTADO', codigo_error: '0', created_at: new Date('2026-11-03T12:00:00Z') }],
      payload_ubl: { lineas: [{ id: 1, descripcion: 'Producto', cantidad: 1, valorUnitario: 100, totalLinea: 118, igvLinea: 18, afectacion: '10' }] } };
    const db = { invoice: { findMany: jest.fn(async () => [row]) }, invoiceAggregate: { findMany: jest.fn(async () => []) },
      company: { findUnique: jest.fn(async () => ({ ruc: '20601234567', legal_name: 'Empresa' })) },
      accountingPeriod: { findUnique: jest.fn(async () => ({ status: situacion === 'CERRADO' ? 'CERRADO' : 'ABIERTO' })) },
      pleBook: { findFirst: jest.fn(async () => situacion === 'PLE' ? { id: 'ple' } : null) } };
    return { db, service: new InvoiceSummaryService(db as never) };
  }
  it.each(['BC01', 'BD01'])('%s permanece fuera de RA aunque el período también esté cerrado', async serie => {
    const h = setup(serie, 'CERRADO');
    const v = await h.service.vistaComunicacionBaja('empresa', '2026-11-03');
    expect(v.lineas[0]).toMatchObject({ incluido: false, motivoExclusion: expect.stringContaining('RC') });
    expect(v.xml).toBeNull();
    expect(h.db.accountingPeriod.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { company_id_period: { company_id: 'empresa', period: '2026-11' } } }));
  });
  it.each(['BC01', 'BD01'].flatMap(serie => ['CERRADO', 'PLE', 'ABIERTO'].map(situacion => [serie, situacion])))('RC %s respeta período %s', async (serie, situacion) => {
    const h = setup(serie, situacion);
    const v = await h.service.vistaAnulacionNotas('empresa', '2026-11-03');
    expect(v.lineas[0].incluido).toBe(situacion === 'ABIERTO');
    if (situacion === 'ABIERTO') expect(v.xml).toContain('<cbc:ConditionCode>3</cbc:ConditionCode>');
    else { expect(v.xml).toBeNull(); expect(v.lineas[0].motivoExclusion).toMatch(/cerrado o declarado en el PLE/); }
  });
});
