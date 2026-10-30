/**
 * TA-33 — Circuit Breaker sobre el estado compartido de resiliencia.
 *
 * Verifica las 3 transiciones de la tarjeta:
 *   CLOSED -> OPEN tras 5 fallos consecutivos.
 *   OPEN -> HALF-OPEN tras 30 s de enfriamiento.
 *   HALF-OPEN -> CLOSED si la petición de prueba acierta (o OPEN si falla).
 */
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import { silenciarLogger } from './invoiceRetryTestSupport';

describe('TA-33 · Circuit Breaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    silenciarLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function abrirCircuito(state: ResilienceStateService): void {
    for (let i = 0; i < 5; i += 1) {
      state.registrarResultadoEnvio(true);
    }
  }

  it('abre después de 5 fallos consecutivos y cierra el paso a SUNAT', () => {
    const state = new ResilienceStateService();

    expect(state.puedeEnviar()).toBe(true);

    for (let i = 0; i < 4; i += 1) {
      state.registrarResultadoEnvio(true);
    }
    expect(state.snapshot(0).state).toBe('CLOSED');
    expect(state.puedeEnviar()).toBe(true);

    state.registrarResultadoEnvio(true);

    expect(state.snapshot(0).state).toBe('OPEN');
    expect(state.puedeEnviar()).toBe(false);
  });

  it('mantiene OPEN durante 30 s y luego permite una petición de prueba', () => {
    const state = new ResilienceStateService();
    abrirCircuito(state);

    jest.advanceTimersByTime(29_999);
    expect(state.puedeEnviar()).toBe(false);
    expect(state.snapshot(0).state).toBe('OPEN');

    jest.advanceTimersByTime(1);
    expect(state.puedeEnviar()).toBe(true);
    expect(state.snapshot(0).state).toBe('HALF_OPEN');
  });

  it('cierra el circuito si la petición de prueba acierta', () => {
    const state = new ResilienceStateService();
    abrirCircuito(state);
    jest.advanceTimersByTime(30_000);

    state.registrarResultadoEnvio(false);

    expect(state.snapshot(0).state).toBe('CLOSED');
    expect(state.puedeEnviar()).toBe(true);
  });

  it('reabre el circuito si la petición de prueba falla', () => {
    const state = new ResilienceStateService();
    abrirCircuito(state);
    jest.advanceTimersByTime(30_000);

    state.registrarResultadoEnvio(true);

    expect(state.snapshot(0).state).toBe('OPEN');
    expect(state.puedeEnviar()).toBe(false);
  });

  it('un CDR de negocio no cuenta como fallo de red', () => {
    const state = new ResilienceStateService();

    for (let i = 0; i < 10; i += 1) {
      state.registrarResultadoEnvio(false);
    }

    expect(state.snapshot(0).state).toBe('CLOSED');
    expect(state.puedeEnviar()).toBe(true);
  });
});
