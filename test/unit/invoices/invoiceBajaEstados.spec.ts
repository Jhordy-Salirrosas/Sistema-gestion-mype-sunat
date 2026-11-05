import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';

describe('vista previa RA: estados admisibles', () => {
  it('incluye aceptados y observados, y excluye ERROR_RED y pendientes', async () => {
    const fecha = new Date('2026-11-03T00:00:00.000Z');
    const filas = ['ACEPTADO', 'OBSERVADO', 'ERROR_RED', 'PENDIENTE'].map((estado, i) => ({ serie: 'F001', correlativo: i + 1, tipo_comprobante: '01', fecha_emision: fecha, estado, monto_total: 118, customer_identity_type: '6', customer_identity_number: '20100070970', total_igv: 18 }));
    const prisma = { invoice: { findMany: jest.fn(async () => filas) }, company: { findUnique: jest.fn(async () => ({ ruc: '20601234567', legal_name: 'Empresa' })) } };
    const vista = await new InvoiceSummaryService(prisma as never).vistaComunicacionBaja('empresa', '2026-11-03');
    expect(vista.lineas.map((l) => l.incluido)).toEqual([true, true, false, false]);
    expect(vista.lineas[2].motivoExclusion).toMatch(/ERROR_RED/);
  });
});
