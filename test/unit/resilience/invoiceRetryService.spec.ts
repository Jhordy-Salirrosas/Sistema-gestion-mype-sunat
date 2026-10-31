/**
 * HU-04 — orquestador de reintentos del envío de comprobantes.
 *
 * Simula una caída de red real: `SunatBillService` recibe un
 * `SunatTransportError` en cada envío, por lo que la política debe esperar
 * 5 s, 15 s y 45 s, auditar los 4 intentos y terminar en DLQ + ERROR_RED.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { dormir } from '../../../src/modules/resilience/infrastructure/queue/invoiceRetryService';
import { CdrPersistenceService } from '../../../src/modules/sunat/cdr-persistence.service';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import { SunatTransportError } from '../../../src/modules/sunat/soap/sunat-soap.client';
import type { SunatSoapClient } from '../../../src/modules/sunat/soap/sunat-soap.client';
import {
  aceptado,
  crearDobles,
  falloDeRed,
  paramsBase,
  silenciarLogger,
  type Dobles,
} from './invoiceRetryTestSupport';

describe('HU-04 · InvoiceRetryService', () => {
  let dobles: Dobles;

  beforeEach(() => {
    silenciarLogger();
    dobles = crearDobles();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fuerza fallos de red, respeta la secuencia 5/15/45 s y manda el job a la DLQ', async () => {
    const { tx, queue, sleep, crearServicio } = dobles;
    const sendBill = jest
      .fn()
      .mockRejectedValue(
        new SunatTransportError('Error de red simulado contra SUNAT'),
      );
    const persistFailure = jest.fn().mockResolvedValue({});

    const sunat = new SunatBillService(
      {
        persist: jest.fn(),
        persistFailure,
      } as unknown as CdrPersistenceService,
      { sendBill } as unknown as SunatSoapClient,
    );

    const resultado = await crearServicio(sunat).processWithRetry(paramsBase);

    // 1. Se hicieron los 3 reintentos (4 envíos en total).
    expect(sendBill).toHaveBeenCalledTimes(4);
    expect(resultado.intentos).toBe(4);

    // 2. Cada intento quedó auditado con su número correlativo.
    expect(persistFailure).toHaveBeenCalledTimes(4);
    const intentosAuditados = persistFailure.mock.calls.map(
      ([datos]: [{ intento: number }]) => datos.intento,
    );
    expect(intentosAuditados).toEqual([1, 2, 3, 4]);

    // 3. La secuencia de espera es la de la historia: 5 s, 15 s y 45 s.
    const esperas = sleep.mock.calls.map(([ms]: [number]) => ms);
    expect(esperas).toEqual([5_000, 15_000, 45_000]);

    // 4. La Invoice queda en ERROR_RED y se registra la transición terminal.
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: paramsBase.invoiceId },
      data: { estado: InvoiceStatus.ERROR_RED },
      select: { company_id: true },
    });
    expect(tx.transactionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: 'company-test',
          invoice_id: paramsBase.invoiceId,
          intento: 4,
          estado_anterior: InvoiceStatus.ENVIADO,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'MAX_REINTENTOS',
        }),
      }),
    );

    // 5. El job se mueve a la DLQ con el motivo y el intento.
    expect(queue.sendToDlq).toHaveBeenCalledTimes(1);
    expect(queue.sendToDlq).toHaveBeenCalledWith(
      paramsBase.invoiceId,
      'company-test',
      expect.objectContaining({
        intento: 4,
        codigo_error: 'MAX_REINTENTOS',
      }),
    );
    expect(resultado.enviadoADlq).toBe(true);
    expect(resultado.estado).toBe(InvoiceStatus.ERROR_RED);
  });

  it('la espera real de producción resuelve sin lanzar', async () => {
    await expect(dormir(0)).resolves.toBeUndefined();
  });

  it('vuelve a ACEPTADO si un reintento tiene éxito y no toca la DLQ', async () => {
    const { tx, queue, sleep, crearServicio } = dobles;
    const sendAndProcess = jest
      .fn()
      .mockResolvedValueOnce(falloDeRed())
      .mockResolvedValueOnce(falloDeRed())
      .mockResolvedValueOnce(aceptado());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat).processWithRetry(paramsBase);

    expect(sendAndProcess).toHaveBeenCalledTimes(3);
    const intentos = sendAndProcess.mock.calls.map(
      ([datos]: [{ intento: number }]) => datos.intento,
    );
    expect(intentos).toEqual([1, 2, 3]);
    expect(sleep.mock.calls.map(([ms]: [number]) => ms)).toEqual([
      5_000, 15_000,
    ]);
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(resultado.enviadoADlq).toBe(false);
    expect(queue.sendToDlq).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});
