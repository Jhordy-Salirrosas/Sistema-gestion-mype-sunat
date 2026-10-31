/**
 * TA-33 — integración del Circuit Breaker con el envío real de comprobantes.
 *
 * El circuito se consulta antes de tocar SUNAT. Si está OPEN, el job no se
 * envía, no se audita como terminal y no va a la DLQ: queda en cola. Tras 30 s
 * se permite una única petición de prueba; el resultado la cierra o la reabre.
 */
import { InvoiceStatus } from '../../../src/generated/client/enums';
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

describe('TA-33 · InvoiceRetryService + Circuit Breaker', () => {
  let dobles: Dobles;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    silenciarLogger();
    dobles = crearDobles();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function abrirCircuito(): void {
    for (let i = 0; i < 5; i += 1) {
      dobles.state.registrarResultadoEnvio(true);
    }
  }

  it('no toca SUNAT ni la cola si el circuito ya está OPEN', async () => {
    const { state, queue, tx, crearServicio } = dobles;
    abrirCircuito();

    const sendAndProcess = jest.fn();
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).not.toHaveBeenCalled();
    expect(queue.sendToDlq).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(resultado.circuitoAbierto).toBe(true);
    expect(resultado.intentos).toBe(0);
    expect(resultado.estado).toBe(InvoiceStatus.PROCESANDO);
  });

  it('el quinto fallo consecutivo abre el circuito y deja el job en cola', async () => {
    const { state, queue, crearServicio } = dobles;

    // Cuatro fallos previos de otros jobs: el quinto ocurre en este envío.
    for (let i = 0; i < 4; i += 1) {
      state.registrarResultadoEnvio(true);
    }

    const sendAndProcess = jest.fn().mockResolvedValue(falloDeRed());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(state.snapshot().state).toBe('OPEN');
    expect(resultado.circuitoAbierto).toBe(true);
    expect(resultado.intentos).toBe(1);
    expect(queue.sendToDlq).not.toHaveBeenCalled();
  });

  it('tras 30 s permite la prueba y cierra con un CDR aceptado', async () => {
    const { state, queue, crearServicio } = dobles;
    abrirCircuito();
    jest.advanceTimersByTime(30_000);

    const sendAndProcess = jest.fn().mockResolvedValue(aceptado());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(state.snapshot().state).toBe('CLOSED');
    expect(resultado.circuitoAbierto).toBe(false);
    expect(resultado.estado).toBe(InvoiceStatus.ACEPTADO);
    expect(queue.sendToDlq).not.toHaveBeenCalled();
  });

  it('si la prueba falla, reabre el circuito y no manda a la DLQ', async () => {
    const { state, queue, crearServicio } = dobles;
    abrirCircuito();
    jest.advanceTimersByTime(30_000);

    const sendAndProcess = jest.fn().mockResolvedValue(falloDeRed());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(state.snapshot().state).toBe('OPEN');
    expect(resultado.circuitoAbierto).toBe(true);
    expect(queue.sendToDlq).not.toHaveBeenCalled();
  });

  it('un rechazo de negocio no abre el circuito', async () => {
    const { state, crearServicio } = dobles;

    const sendAndProcess = jest.fn().mockResolvedValue(rechazoDeNegocio());
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(state.snapshot().state).toBe('CLOSED');
    expect(resultado.estado).toBe(InvoiceStatus.RECHAZADO);
    expect(resultado.circuitoAbierto).toBe(false);
  });

  it('en HALF-OPEN permite una sola petición de prueba a la vez', async () => {
    const { state, queue, crearServicio } = dobles;
    abrirCircuito();
    jest.advanceTimersByTime(30_000);

    let resolver!: (valor: ProcessCdrResult) => void;
    const sendAndProcess = jest.fn(
      () =>
        new Promise<ProcessCdrResult>((resolve) => {
          resolver = resolve;
        }),
    );
    const sunat = { sendAndProcess } as unknown as SunatBillService;
    const servicio = crearServicio(sunat, state);

    const primera = servicio.processWithRetry(paramsBase);
    const segunda = await servicio.processWithRetry(paramsBase);

    expect(sendAndProcess).toHaveBeenCalledTimes(1);
    expect(segunda.circuitoAbierto).toBe(true);

    resolver(aceptado());
    const resultadoPrimera = await primera;

    expect(resultadoPrimera.circuitoAbierto).toBe(false);
    expect(state.snapshot().state).toBe('CLOSED');
    expect(queue.sendToDlq).not.toHaveBeenCalled();
  });

  it('libera la reserva de HALF-OPEN si el envío lanza un error inesperado', async () => {
    const { state, crearServicio } = dobles;
    abrirCircuito();
    jest.advanceTimersByTime(30_000);

    const sendAndProcess = jest
      .fn()
      .mockRejectedValue(new Error('No se pudo persistir el CDR'));
    const sunat = { sendAndProcess } as unknown as SunatBillService;

    const resultado = await crearServicio(sunat, state).processWithRetry(
      paramsBase,
    );

    expect(resultado.enviadoADlq).toBe(true);
    expect(state.puedeEnviar()).toBe(true);
    expect(state.snapshot().state).toBe('HALF_OPEN');
  });
});
