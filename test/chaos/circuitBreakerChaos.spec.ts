/**
 * Pruebas de Caos — deteccion de fallos y MTTD (M2).
 *
 * Verifica la transicion CLOSED -> OPEN de la spec §2.2 y la metrica
 * MTTD <= 5 s del charter §2.3, usando el `CircuitBreaker` REAL y el
 * `SunatMockService` REAL con su inyector de fallos por RUC.
 *
 * La recuperacion (MTTR) vive en `circuitBreakerRecovery.spec.ts` y la DLQ en
 * `dlqChaos.spec.ts`.
 */
import { CircuitState } from '../../src/modules/resilience/infrastructure/circuitBreaker/circuitBreaker';
import { SunatMockService } from '../../src/modules/resilience/infrastructure/mock/sunat-mock.service';
import { ChaosHarness } from './chaosHarness';
import {
  MTTD_MAX_MS,
  RUC_503,
  RUC_OK,
  UMBRAL_FALLOS,
  crearEscenario,
  inyectarFallos,
  type EscenarioCaos,
} from './circuitBreakerSupport';

jest.setTimeout(60_000);

describe('M2 · Circuit Breaker — deteccion y MTTD', () => {
  let escenario: EscenarioCaos;

  beforeEach(() => {
    escenario = crearEscenario();
  });

  describe('Inyeccion de fallo del Mock SUNAT', () => {
    it('el RUC del catalogo devuelve HTTP 503 al simular caida', async () => {
      const res = await new SunatMockService().resolveResponse(
        ChaosHarness.fileName(RUC_503, 1),
      );

      expect(res.status).toBe(503);
      expect(res.body).toContain('S:Envelope');
    });

    it('un RUC normal devuelve un CDR aceptado', async () => {
      const res = await new SunatMockService().resolveResponse(
        ChaosHarness.fileName(RUC_OK, 1),
      );

      expect(res.status).toBe(200);
      expect(res.body).toContain('applicationResponse');
    });
  });

  describe('MTTD <= 5 s (CLOSED -> OPEN)', () => {
    it('abre el circuito al acumular 5 errores consecutivos', async () => {
      const inicio = escenario.reloj.ahora();
      await inyectarFallos(escenario.harness, UMBRAL_FALLOS);

      const mttd = escenario.reloj.ahora() - inicio;

      expect(escenario.circuito.getState()).toBe(CircuitState.OPEN);
      expect(mttd).toBeLessThanOrEqual(MTTD_MAX_MS);
    });

    it('no abre antes de alcanzar el umbral', async () => {
      await inyectarFallos(escenario.harness, UMBRAL_FALLOS - 1);

      expect(escenario.circuito.getState()).toBe(CircuitState.CLOSED);
      expect(escenario.circuito.getFallosConsecutivos()).toBe(
        UMBRAL_FALLOS - 1,
      );
    });

    it('rechaza con fast-fail una vez abierto, sin tocar el Mock', async () => {
      await inyectarFallos(escenario.harness, UMBRAL_FALLOS);

      const rechazado = await escenario.harness.enviar(
        ChaosHarness.fileName(RUC_503, 99),
      );

      expect(rechazado.ejecutado).toBe(false);
      expect(rechazado.estado).toBe(CircuitState.OPEN);
      expect(rechazado.httpStatus).toBeUndefined();
    });

    it('un exito reinicia el contador de fallos', async () => {
      await inyectarFallos(escenario.harness, UMBRAL_FALLOS - 1);
      await escenario.harness.enviar(ChaosHarness.fileName(RUC_OK, 90));

      expect(escenario.circuito.getFallosConsecutivos()).toBe(0);

      await inyectarFallos(escenario.harness, UMBRAL_FALLOS - 1, 100);
      expect(escenario.circuito.getState()).toBe(CircuitState.CLOSED);
    });
  });
});
