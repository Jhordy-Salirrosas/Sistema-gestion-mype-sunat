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
