/**
 * TA-34 — escenarios 1 y 2: 503 sostenido y timeout.
 *
 * Usa el `InvoiceRetryService`, `SunatBillService` y `CdrPersistenceService`
 * reales; solo se sustituyen la red SOAP, Prisma y pg-boss. Así se verifica la
 * secuencia de reintentos, las filas de auditoría y el paso a la DLQ sin
 * depender de Supabase.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import {
  SunatTransportError,
  type SunatSoapClient,
} from '../../../src/modules/sunat/soap/sunat-soap.client';
import {
  BASE,
  crearDb,
  crearPersistencia,
  crearRetry,
  silenciarLogger,
} from './ta34Support';

describe('TA-34 · 503 sostenido y timeout', () => {
  beforeEach(() => {
    silenciarLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('503 sostenido: agota los 3 reintentos y deja el job en la DLQ', async () => {
    const db = crearDb(BASE.invoiceId);
    const persistence = crearPersistencia(db);
    const persistFailure = jest.spyOn(persistence, 'persistFailure');
    const queue = { sendToDlq: jest.fn().mockResolvedValue('dlq-1') };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const soap = {
      sendBill: jest
        .fn()
        .mockRejectedValue(
          new SunatTransportError('HTTP 503 sin SOAP Fault', {
            httpStatus: 503,
          }),
        ),
    } as unknown as SunatSoapClient;

    const retry = crearRetry({
      db,
      persistence,
      soap,
      queue,
      state: new ResilienceStateService(),
      sleep,
    });

    const resultado = await retry.processWithRetry(BASE);

    expect(soap.sendBill).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]: [number]) => ms)).toEqual([
      5_000, 15_000, 45_000,
    ]);
    expect(persistFailure).toHaveBeenCalledTimes(4);
    expect(db.invoices.get(BASE.invoiceId)?.estado).toBe(
      InvoiceStatus.ERROR_RED,
    );
    expect(queue.sendToDlq).toHaveBeenCalledTimes(1);
    expect(resultado.enviadoADlq).toBe(true);
    expect(
      db.history.some((fila) => fila.codigo_error === 'MAX_REINTENTOS'),
    ).toBe(true);
  });

  it('timeout: reintenta y cada intento queda auditado en TransactionHistory', async () => {
    const db = crearDb(BASE.invoiceId);
    const persistence = crearPersistencia(db);
    const queue = { sendToDlq: jest.fn().mockResolvedValue('dlq-2') };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const soap = {
      sendBill: jest
        .fn()
        .mockRejectedValue(
          new SunatTransportError(
            'Timeout de 30000 ms esperando al billService',
          ),
        ),
    } as unknown as SunatSoapClient;

    const retry = crearRetry({
      db,
      persistence,
      soap,
      queue,
      state: new ResilienceStateService(),
      sleep,
    });

    const resultado = await retry.processWithRetry(BASE);

    expect(soap.sendBill).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]: [number]) => ms)).toEqual([
      5_000, 15_000, 45_000,
    ]);
    expect(
      db.history.filter((fila) => fila.estado_nuevo === InvoiceStatus.ENVIADO),
    ).toHaveLength(4);
    expect(resultado.enviadoADlq).toBe(true);
  });
});
