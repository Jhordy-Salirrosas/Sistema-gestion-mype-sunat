/**
 * TA-32 · conciliación antes de reintentar (criterio 3).
 *
 * Cuando un envío termina en timeout el comprobante queda incierto: SUNAT pudo
 * haberlo procesado. El orquestador pregunta por el estado antes de reenviar;
 * si SUNAT ya lo tenía, se recupera su CDR y no se reenvía nada.
 *
 * Los dobles de Prisma, cola y reloj vienen del soporte compartido de HU-04.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
import type { PrismaService } from '../../../src/database/prismaService';
import { InvoiceDlqService } from '../../../src/modules/resilience/infrastructure/queue/invoiceDlqService';
import {
  InvoiceRetryService,
  type ConsultaEstadoPort,
} from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import type { ProcessCdrResult } from '../../../src/modules/sunat/soap/sunatBillTypes';
import {
  aceptado,
  crearDobles,
  falloDeRed,
  paramsBase,
  rechazoDeNegocio,
  silenciarLogger,
  type Dobles,
} from './invoiceRetryTestSupport';

describe('TA-32 · conciliación antes de reintentar', () => {
  let dobles: Dobles;

  beforeEach(() => {
    silenciarLogger();
    dobles = crearDobles();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function crearServicio(
    sunat: SunatBillService,
    consulta: ConsultaEstadoPort,
  ): InvoiceRetryService {
    return new InvoiceRetryService(
      new InvoiceDlqService(
        dobles.prisma as unknown as PrismaService,
        dobles.queue as unknown as QueueService,
      ),
      sunat,
      dobles.state,
      dobles.sleep,
      consulta,
    );
  }

  function sunatQueDevuelve(...resultados: ProcessCdrResult[]) {
    const sendAndProcess = jest.fn();
    for (const resultado of resultados) {
      sendAndProcess.mockResolvedValueOnce(resultado);
    }
    return {
      sunat: { sendAndProcess } as unknown as SunatBillService,
      sendAndProcess,
    };
  }

  it('recupera el CDR de SUNAT y no reenvía el comprobante', async () => {
    const { sunat, sendAndProcess } = sunatQueDevuelve(falloDeRed());
    const consulta = {
      consultarEstado: jest.fn().mockResolvedValue({
        ...aceptado(),
        cdr: { responseCode: '0' } as never,
      }),
    } as unknown as ConsultaEstadoPort;

    const resultado = await crearServicio(sunat, consulta).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(consulta.consultarEstado).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: paramsBase.invoiceId,
        correlativo: paramsBase.correlativo,
        intento: 1,
      }),
    );
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(resultado.reintentable).toBe(false);
    expect(dobles.sleep).not.toHaveBeenCalled();
  });

  it('reenvía cuando la consulta tampoco trae un CDR', async () => {
    const { sunat, sendAndProcess } = sunatQueDevuelve(
      falloDeRed(),
      rechazoDeNegocio(),
    );
    const consulta = {
      consultarEstado: jest
        .fn()
        .mockResolvedValue({ ...falloDeRed(), cdr: null }),
    } as unknown as ConsultaEstadoPort;

    const resultado = await crearServicio(sunat, consulta).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(2);
    expect(dobles.sleep).toHaveBeenCalledWith(5_000);
    expect(resultado.estado).toBe(InvoiceStatus.RECHAZADO);
  });

  it('si la consulta falla, continúa con el reintento en vez de abortar', async () => {
    const { sunat, sendAndProcess } = sunatQueDevuelve(
      falloDeRed(),
      rechazoDeNegocio(),
    );
    const consulta = {
      consultarEstado: jest
        .fn()
        .mockRejectedValue(new Error('consultService caído')),
    } as unknown as ConsultaEstadoPort;

    const resultado = await crearServicio(sunat, consulta).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(2);
    expect(resultado.estado).toBe(InvoiceStatus.RECHAZADO);
  });

  it('informa a la consulta el número de intento real, no un 1 fijo', async () => {
    const { sunat } = sunatQueDevuelve(
      falloDeRed(),
      falloDeRed(),
      rechazoDeNegocio(),
    );
    const consultarEstado = jest.fn().mockResolvedValue(null);
    const consulta = { consultarEstado } as unknown as ConsultaEstadoPort;

    await crearServicio(sunat, consulta).processWithRetry(paramsBase);

    expect(consultarEstado.mock.calls.map(([usada]) => usada.intento)).toEqual([
      1, 2,
    ]);
  });
});
