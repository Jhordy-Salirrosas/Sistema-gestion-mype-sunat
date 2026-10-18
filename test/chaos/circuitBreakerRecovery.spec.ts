/**
 * Pruebas de Caos — recuperacion y MTTR (M2).
 *
 * Verifica las transiciones OPEN -> HALF-OPEN -> CLOSED de la spec §2.2 y la
 * metrica MTTR <= 60 s del charter §2.3, usando el `CircuitBreaker` REAL y el
 * `SunatMockService` REAL.
 *
 * La deteccion (MTTD) vive en `circuitBreakerChaos.spec.ts` y la DLQ en
 * `dlqChaos.spec.ts`.
 */
import { CircuitState } from '../../src/modules/resilience/infrastructure/circuitBreaker/circuitBreaker';
import { ChaosHarness } from './chaosHarness';
import {
  MTTD_MAX_MS,
  MTTR_MAX_MS,
  RUC_503,
  UMBRAL_FALLOS,
  VENTANA_ENFRIAMIENTO_MS,
  crearEscenario,
  inyectarFallos,
  medirRecuperacion,
  type EscenarioCaos,
} from './circuitBreakerSupport';

jest.setTimeout(60_000);

describe('M2 · Circuit Breaker — recuperacion y MTTR', () => {
  let escenario: EscenarioCaos;

  beforeEach(() => {
    escenario = crearEscenario();
  });

  it('respeta la ventana de enfriamiento antes de permitir la prueba', async () => {
    await inyectarFallos(escenario.harness, UMBRAL_FALLOS);
    expect(escenario.circuito.getState()).toBe(CircuitState.OPEN);

    // Aun dentro de la ventana sigue bloqueando.
    escenario.reloj.avanzar(VENTANA_ENFRIAMIENTO_MS - 1);
    expect(escenario.circuito.getState()).toBe(CircuitState.OPEN);
    expect(escenario.circuito.estaBloqueando()).toBe(true);

    // Cumplida la ventana, permite la peticion de prueba.
    escenario.reloj.avanzar(1);
    expect(escenario.circuito.getState()).toBe(CircuitState.HALF_OPEN);
    expect(escenario.circuito.estaBloqueando()).toBe(false);
  });

  it('se recupera (OPEN -> HALF-OPEN -> CLOSED) dentro de 60 s', async () => {
    await inyectarFallos(escenario.harness, UMBRAL_FALLOS);
    expect(escenario.circuito.getState()).toBe(CircuitState.OPEN);

    const { mttr, httpStatus, ejecutado } =
      await medirRecuperacion(escenario);

    expect(ejecutado).toBe(true);
    expect(httpStatus).toBe(200);
    expect(escenario.circuito.getState()).toBe(CircuitState.CLOSED);
    expect(mttr).toBeLessThanOrEqual(MTTR_MAX_MS);
  });

  it('si la peticion de prueba falla, reabre el circuito', async () => {
    await inyectarFallos(escenario.harness, UMBRAL_FALLOS);
    escenario.reloj.avanzar(VENTANA_ENFRIAMIENTO_MS);
    expect(escenario.circuito.getState()).toBe(CircuitState.HALF_OPEN);

    // SUNAT sigue caida: la prueba falla y obliga a reabrir.
    await escenario.harness.enviar(ChaosHarness.fileName(RUC_503, 92));

    expect(escenario.circuito.getState()).toBe(CircuitState.OPEN);
    expect(escenario.circuito.estaBloqueando()).toBe(true);
  });

  it('permite una sola peticion de prueba en HALF-OPEN', async () => {
    await inyectarFallos(escenario.harness, UMBRAL_FALLOS);
    escenario.reloj.avanzar(VENTANA_ENFRIAMIENTO_MS);
    expect(escenario.circuito.getState()).toBe(CircuitState.HALF_OPEN);

    const primera = escenario.circuito.ejecutar(async () => 'ok');
    const segunda = await escenario.circuito.ejecutar(async () => 'no');

    expect((await primera).ejecutado).toBe(true);
    expect(segunda.ejecutado).toBe(false);
  });

  it('los umbrales del charter son los documentados (5 s / 60 s)', () => {
    expect(MTTD_MAX_MS).toBeLessThanOrEqual(5_000);
    expect(MTTR_MAX_MS).toBeLessThanOrEqual(60_000);
  });
});
