/**
 * TA-34 — escenario 3: caída y retorno sin pérdida de comprobantes.
 *
 * Abre el `CircuitBreaker` real, verifica que los jobs quedan en cola sin
 * tocar SUNAT, avanza los 30 s de enfriamiento y comprueba que todos se
 * procesan al volver el servicio. Mide MTTD y MTTR con reloj virtual.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { SunatBillService } from '../../../src/modules/sunat/sunat-bill.service';
import type { SunatSoapClient } from '../../../src/modules/sunat/soap/sunat-soap.client';
import type { SendInvoiceParams } from '../../../src/modules/sunat/soap/sunatBillTypes';
import {
  aceptado,
  BASE,
  crearDb,
  crearPersistencia,
  crearRetry,
  silenciarLogger,
} from './ta34Support';

describe('TA-34 · caída y retorno', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    silenciarLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('0 comprobantes perdidos, MTTD <= 5 s y MTTR <= 60 s', async () => {
    const state = new ResilienceStateService();
    const queue = { sendToDlq: jest.fn().mockResolvedValue('dlq-3') };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const sendAndProcess = jest.fn().mockResolvedValue(aceptado());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const db = crearDb(BASE.invoiceId);
    const persistence = crearPersistencia(db);
    const retry = crearRetry({
      db,
      persistence,
      soap: { sendBill: jest.fn() } as unknown as SunatSoapClient,
      queue,
      state,
      sleep,
      sunatBill: sunat,
    });

    const inicioCaida = Date.now();
    for (let i = 0; i < 5; i += 1) {
      state.registrarResultadoEnvio(true);
    }
    const mttd = Date.now() - inicioCaida;
    expect(mttd).toBeLessThanOrEqual(5_000);
    expect(state.puedeEnviar()).toBe(false);

    const jobs: SendInvoiceParams[] = Array.from({ length: 5 }, (_, i) => ({
      ...BASE,
      invoiceId: `inv-caida-${i}`,
    }));

    const pendientes: SendInvoiceParams[] = [];
    for (const job of jobs) {
      const resultado = await retry.processWithRetry(job);
      expect(resultado.circuitoAbierto).toBe(true);
      pendientes.push(job);
    }
    expect(sendAndProcess).not.toHaveBeenCalled();
    expect(pendientes).toHaveLength(jobs.length);

    const restauradoEn = Date.now();
    jest.advanceTimersByTime(30_000);

    const procesados: string[] = [];
    for (const job of pendientes) {
      const resultado = await retry.processWithRetry(job);
      expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
      procesados.push(job.invoiceId);
    }

    const mttr = Date.now() - restauradoEn;
    expect(mttr).toBeLessThanOrEqual(60_000);
    expect(state.snapshot().state).toBe('CLOSED');
    expect(new Set(procesados).size).toBe(jobs.length);
    expect(jobs.filter((job) => !procesados.includes(job.invoiceId))).toEqual(
      [],
    );
  });
});
