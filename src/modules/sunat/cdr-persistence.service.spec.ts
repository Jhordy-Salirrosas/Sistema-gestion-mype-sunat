/**
 * Pruebas de persistencia del CDR (criterios 3 y 6 de TA-03).
 *
 * Se usa un stub de Prisma en lugar de una base real: lo que se verifica es
 * QUE se escribe (el JSON de cdr_sunat y la fila de TransactionHistory), no el
 * motor de PostgreSQL. Por eso la prueba es rapida y no necesita Supabase.
 */
import { InvoiceStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CdrPersistenceService } from './cdr-persistence.service';
import { classifyCdr } from './soap/cdr.classifier';
import { parseCdr } from './soap/cdr.parser';
import {
  buildMockCdrXml,
  toApplicationResponse,
} from './mock/cdr-mock.fixtures';

interface Llamadas {
  invoiceUpdate: Array<Record<string, unknown>>;
  historyCreate: Array<Record<string, unknown>>;
}

function createPrismaStub(): { prisma: PrismaService; llamadas: Llamadas } {
  const llamadas: Llamadas = { invoiceUpdate: [], historyCreate: [] };

  const tx = {
    invoice: {
      update: jest.fn(async (args: Record<string, unknown>) => {
        llamadas.invoiceUpdate.push(args);
        const data = args.data as { estado: InvoiceStatus };
        return { id: 'inv-1', estado: data.estado, updated_at: new Date() };
      }),
    },
    transactionHistory: {
      create: jest.fn(async (args: Record<string, unknown>) => {
        llamadas.historyCreate.push(args);
        return { id: 'hist-1' };
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as unknown as PrismaService;

  return { prisma, llamadas };
}

/** Un CDR aceptado con una observacion 4031. */
function cdrConObservacion() {
  return parseCdr(
    toApplicationResponse(
      buildMockCdrXml({
        responseCode: '0',
        description: 'La Factura numero F001-00000001, ha sido aceptada',
        observaciones: ['4031 - Debe indicar el nombre comercial'],
      }),
    ),
  );
}

describe('CdrPersistenceService', () => {
  it('persiste el CDR en Invoice.cdr_sunat con el codigo como string', async () => {
    const { prisma, llamadas } = createPrismaStub();
    const service = new CdrPersistenceService(prisma);
    const cdr = cdrConObservacion();

    await service.persist({
      invoiceId: 'inv-1',
      cdr,
      classification: classifyCdr(cdr),
      tiempoRespuestaMs: 1200,
      estadoAnterior: InvoiceStatus.PROCESANDO,
      intento: 1,
    });

    expect(llamadas.invoiceUpdate).toHaveLength(1);
    const data = llamadas.invoiceUpdate[0].data as {
      estado: InvoiceStatus;
      cdr_sunat: Record<string, unknown>;
    };

    expect(data.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(data.cdr_sunat.responseCode).toBe('0');
    expect(data.cdr_sunat.referenceId).toBe('F001-00000001');
    expect(data.cdr_sunat.clasificacion).toBe('ACEPTADO_CON_OBSERVACIONES');
    expect(data.cdr_sunat.valido).toBe(true);
    expect(data.cdr_sunat.observaciones).toEqual([
      { codigo: '4031', texto: '4031 - Debe indicar el nombre comercial' },
    ]);
    // El XML crudo es la constancia de SUNAT: debe quedar guardado.
    expect(String(data.cdr_sunat.rawXml)).toContain('ApplicationResponse');
  });

  it('registra tiempo_respuesta_ms y la transicion en TransactionHistory', async () => {
    const { prisma, llamadas } = createPrismaStub();
    const service = new CdrPersistenceService(prisma);
    const cdr = cdrConObservacion();

    await service.persist({
      invoiceId: 'inv-1',
      cdr,
      classification: classifyCdr(cdr),
      tiempoRespuestaMs: 847,
      estadoAnterior: InvoiceStatus.PROCESANDO,
      intento: 3,
    });

    expect(llamadas.historyCreate).toHaveLength(1);
    const data = llamadas.historyCreate[0].data as Record<string, unknown>;

    expect(data.invoice_id).toBe('inv-1');
    expect(data.intento).toBe(3);
    expect(data.estado_anterior).toBe(InvoiceStatus.PROCESANDO);
    expect(data.estado_nuevo).toBe(InvoiceStatus.ACEPTADO);
    expect(data.codigo_error).toBe('0');
    expect(data.tiempo_respuesta_ms).toBe(847);
    expect(String(data.mensaje_error)).toContain('ha sido aceptada');
  });

  it('conserva el cero inicial de los codigos 0100 al persistir', async () => {
    const { prisma, llamadas } = createPrismaStub();
    const service = new CdrPersistenceService(prisma);
    const cdr = parseCdr(
      toApplicationResponse(
        buildMockCdrXml({
          responseCode: '0100',
          description: 'El sistema no puede responder su solicitud',
        }),
      ),
    );

    await service.persist({
      invoiceId: 'inv-2',
      cdr,
      classification: classifyCdr(cdr),
      tiempoRespuestaMs: 30_000,
      estadoAnterior: InvoiceStatus.PROCESANDO,
      intento: 1,
    });

    const data = llamadas.invoiceUpdate[0].data as {
      cdr_sunat: { responseCode: string };
    };
    expect(data.cdr_sunat.responseCode).toBe('0100');
    expect(data.cdr_sunat.responseCode).not.toBe('100');
  });

  it('audita un fallo de transporte sin perder el comprobante', async () => {
    const { prisma, llamadas } = createPrismaStub();
    const service = new CdrPersistenceService(prisma);

    await service.persistFailure({
      invoiceId: 'inv-3',
      estadoNuevo: InvoiceStatus.ENVIADO,
      estadoAnterior: InvoiceStatus.PROCESANDO,
      intento: 1,
      codigoError: null,
      mensajeError: 'Timeout de 30000 ms esperando al billService',
      tiempoRespuestaMs: null,
    });

    const invoiceData = llamadas.invoiceUpdate[0].data as {
      estado: InvoiceStatus;
    };
    const historyData = llamadas.historyCreate[0].data as Record<
      string,
      unknown
    >;

    // ENVIADO = estado incierto para conciliar, no un error de red definitivo.
    expect(invoiceData.estado).toBe(InvoiceStatus.ENVIADO);
    expect(historyData.estado_anterior).toBe(InvoiceStatus.PROCESANDO);
    expect(historyData.estado_nuevo).toBe(InvoiceStatus.ENVIADO);
    expect(historyData.codigo_error).toBeNull();
    expect(historyData.tiempo_respuesta_ms).toBeNull();
    expect(String(historyData.mensaje_error)).toContain('Timeout');
  });

  it('usa una sola transaccion para el comprobante y el historial', async () => {
    const { prisma } = createPrismaStub();
    const service = new CdrPersistenceService(prisma);
    const cdr = cdrConObservacion();

    await service.persist({
      invoiceId: 'inv-1',
      cdr,
      classification: classifyCdr(cdr),
      tiempoRespuestaMs: 10,
      estadoAnterior: null,
      intento: 1,
    });

    // Atomicidad: el estado del comprobante y su traza no pueden divergir.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
