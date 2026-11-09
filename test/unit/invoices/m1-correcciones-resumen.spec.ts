import { InvoiceSummaryService } from '../../../src/modules/invoices/application/services/invoiceSummaryService';

describe('M1 filas de bajas y resúmenes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it.each(['vistaResumenDiario', 'vistaComunicacionBaja'] as const)(
    '%s conserva tipo y estado, y solo permite reenviar estados sin recepción SUNAT',
    async (method) => {
      const estados = [
        'PENDIENTE',
        'EN_COLA',
        'ERROR_RED',
        'PROCESANDO',
        'ACEPTADO',
        'OBSERVADO',
        'RECHAZADO',
        'ANULADO',
      ];
      const tipo = method === 'vistaResumenDiario' ? '03' : '01';
      const filas = estados.map((estado, i) => ({
        id: `inv-${i}`,
        serie: tipo === '03' ? 'B001' : 'F001',
        correlativo: i + 1,
        tipo_comprobante: tipo,
        estado,
        fecha_emision: new Date('2026-11-07T12:00:00Z'),
        monto_total: 118,
        total_igv: 18,
        customer_identity_type: '1',
        customer_identity_number: '12345678',
      }));
      const prisma = {
        invoice: { findMany: jest.fn().mockResolvedValue(filas) },
        company: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ruc: '20100070970', legal_name: 'Emisor' }),
        },
      };
      const vista = await new InvoiceSummaryService(prisma as never)[method](
        'empresa',
        '2026-11-07',
      );
      expect(
        vista.lineas.map((l) => ({
          id: l.id,
          tipo: l.tipoComprobante,
          estado: l.estado,
          reenviable: l.reenviable,
        })),
      ).toEqual(
        estados.map((estado, i) => ({
          id: `inv-${i}`,
          tipo,
          estado,
          reenviable: method === 'vistaResumenDiario' ? false : i < 3,
        })),
      );
      expect(prisma.invoice.findMany.mock.calls[0][0].where.company_id).toBe(
        'empresa',
      );
      if (method === 'vistaComunicacionBaja')
        expect(
          vista.lineas.filter((l) => l.incluido).map((l) => l.estado),
        ).toEqual(['ACEPTADO', 'OBSERVADO']);
    },
  );
});

describe('M1 proyección de filas desde el controlador de bajas y resúmenes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-08T02:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it.each(['vistaResumen', 'vistaBaja'] as const)(
    '%s conserva los datos SUNAT y usa el día de Lima por defecto',
    async (method) => {
      const { InvoiceQueryController } =
        await import('../../../src/modules/invoices/infrastructure/controllers/invoiceQueryController');
      const filas = [
        {
          id: 'fila',
          tipo_comprobante: method === 'vistaResumen' ? '03' : '01',
          serie: method === 'vistaResumen' ? 'B001' : 'F001',
          correlativo: 1,
          estado: 'ERROR_RED',
          monto_total: 118,
          fecha_emision: new Date('2026-11-07T12:00:00Z'),
        },
      ];
      const prisma = {
        invoice: { findMany: jest.fn().mockResolvedValue(filas) },
        company: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ruc: '20100070970', legal_name: 'Emisor' }),
        },
      };
      const summary = new InvoiceSummaryService(prisma as never);
      const controller = new InvoiceQueryController(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        summary,
        {} as never,
      );
      const result = await controller[method]('empresa');
      expect(result.envio.fechaReferencia).toBe('2026-11-07');
      expect(result.lineas[0]).toMatchObject({
        id: 'fila',
        tipoComprobante: filas[0].tipo_comprobante,
        estado: 'ERROR_RED',
        reenviable: method !== 'vistaResumen',
      });
      const explicit = await controller[method]('empresa', ' 2026-11-07 ', '2');
      expect(explicit.envio.correlativo).toBe(2);
      expect(explicit.lineas).toEqual(result.lineas);
    },
  );
});
