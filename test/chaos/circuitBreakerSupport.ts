/**
 * Andamiaje comun de las pruebas de caos del Circuit Breaker (M2).
 *
 * El Circuit Breaker se apoya en un reloj inyectable; estas utilidades crean un
 * reloj virtual para medir MTTD y MTTR sin esperar los 30 s reales de
 * enfriamiento que exige la spec.
 */
import { CircuitBreaker } from '../../src/modules/resilience/infrastructure/circuitBreaker/circuitBreaker';
import { SunatMockService } from '../../src/modules/resilience/infrastructure/mock/sunat-mock.service';
import {
  FAULT_RUC_BY_MODE,
  SunatFaultMode,
} from '../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures';
import { ChaosHarness } from './chaosHarness';

/** Metas del charter de resiliencia (spec §2.3). */
export const MTTD_MAX_MS = 5_000;
export const MTTR_MAX_MS = 60_000;

/** Umbral de fallos y ventana de enfriamiento de la spec §2.2. */
export const UMBRAL_FALLOS = 5;
export const VENTANA_ENFRIAMIENTO_MS = 30_000;

/** RUC que activa el modo 503 del catalogo de fallos del Mock. */
export const RUC_503 = FAULT_RUC_BY_MODE[SunatFaultMode.SERVICE_UNAVAILABLE];

/** RUC normal: recibe un CDR aceptado. */
export const RUC_OK = '20123456786';

/** Reloj virtual: permite medir MTTD/MTTR sin esperar 30 s reales. */
export function crearReloj() {
  let ahora = 0;
  return {
    ahora: () => ahora,
    avanzar: (ms: number) => {
      ahora += ms;
    },
  };
}

export type Reloj = ReturnType<typeof crearReloj>;

/** Escenario completo: reloj, circuito y harness conectados entre si. */
export interface EscenarioCaos {
  reloj: Reloj;
  circuito: CircuitBreaker;
  harness: ChaosHarness;
}

/** Crea un circuito y su harness sobre un reloj virtual nuevo. */
export function crearEscenario(): EscenarioCaos {
  const reloj = crearReloj();
  const circuito = new CircuitBreaker({
    umbralFallos: UMBRAL_FALLOS,
    ventanaEnfriamientoMs: VENTANA_ENFRIAMIENTO_MS,
    ahora: reloj.ahora,
  });

  return {
    reloj,
    circuito,
    harness: new ChaosHarness(new SunatMockService(), circuito),
  };
}

/** Provoca `veces` fallos consecutivos contra el Mock. */
export async function inyectarFallos(
  harness: ChaosHarness,
  veces: number,
  desde = 1,
): Promise<void> {
  for (let i = desde; i < desde + veces; i += 1) {
    await harness.enviar(ChaosHarness.fileName(RUC_503, i));
  }
}

/**
 * Ciclo completo de recuperacion: tras abrir el circuito se restablece SUNAT,
 * se cumple la ventana de enfriamiento y se mide el MTTR hasta CLOSED.
 */
export async function medirRecuperacion({
  reloj,
  circuito,
  harness,
}: EscenarioCaos): Promise<{
  mttr: number;
  httpStatus: number | undefined;
  ejecutado: boolean;
}> {
  const restablecimiento = reloj.ahora();
  reloj.avanzar(VENTANA_ENFRIAMIENTO_MS);

  const prueba = await harness.enviar(ChaosHarness.fileName(RUC_OK, 91));
  reloj.avanzar(1_000); // drenaje de la cola pendiente

  void circuito;

  return {
    mttr: reloj.ahora() - restablecimiento,
    httpStatus: prueba.httpStatus,
    ejecutado: prueba.ejecutado,
  };
}
