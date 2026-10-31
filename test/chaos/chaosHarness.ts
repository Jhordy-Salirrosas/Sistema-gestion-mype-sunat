/**
 * Adaptador de cola para pruebas de caos (M2).
 *
 * Conecta el Circuit Breaker con el mock del billService y con la cola de
 * pg-boss, de modo que un fallo de SUNAT:
 *   1. se cuente en el circuito, y
 *   2. se descarte con reintentos hasta que pg-boss mueva el job a la DLQ,
 *      sin perder la transaccion.
 *
 * Las colas de caos llevan sufijo propio para no interferir con las colas de
 * produccion que usan otras suites (p. ej. el Outbox) cuando Jest ejecuta en
 * paralelo.
 */
import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
} from '../../src/modules/resilience/infrastructure/circuitBreaker/circuitBreaker';
import { SunatMockService } from '../../src/modules/resilience/infrastructure/mock/sunat-mock.service';
import { SunatFaultMode } from '../../src/modules/resilience/infrastructure/mock/sunat-fault-injection.fixtures';
import { INVOICE_DLQ, INVOICE_QUEUE } from '../../src/modules/resilience/infrastructure/queue/queue.service';

/** Sufijo exclusivo de las colas de caos, para aislarlas de otras suites. */
export const CHAOS_SUFFIX = '-chaos-m2';

/**
 * Colas de caos. Se derivan de las definidas en produccion
 * (`queue.service.ts`) para que la prueba siga validando esas constantes, pero
 * con un sufijo propio que evita colisiones cuando las suites de Jest corren en
 * paralelo sobre la misma base de datos.
 */
export const MAIN_QUEUE = `${INVOICE_QUEUE}${CHAOS_SUFFIX}`;
export const DLQ_QUEUE = `${INVOICE_DLQ}${CHAOS_SUFFIX}`;

/** Resultado de un envio SIMULADO a traves del circuito. */
export interface EnvioResultado {
  /** Indica si la peticion llego al mock (false = fast-fail). */
  ejecutado: boolean;
  /** Codigo HTTP devuelto por el mock, cuando se ejecuto. */
  httpStatus?: number;
  /** Estado del circuito despues del intento. */
  estado: CircuitState;
}

/**
 * Traduce un modo de fallo del Mock al resultado observable del envio.
 *
 * `SERVICE_UNAVAILABLE` (503) y `TIMEOUT` cuentan como fallo de red segun la
 * spec §2.2; el resto devuelve 200.
 */
export class ChaosHarness {
  readonly circuito: CircuitBreaker;

  constructor(
    private readonly mock: SunatMockService,
    circuito?: CircuitBreaker,
  ) {
    this.circuito = circuito ?? new CircuitBreaker();
  }

  /**
   * Envia un comprobante simulado al Mock a traves del Circuit Breaker.
   *
   * - Si el circuito esta OPEN devuelve fast-fail sin tocar el Mock.
   * - Un 503 o un timeout se cuentan como fallo consecutivo.
   */
  async enviar(fileName: string): Promise<EnvioResultado> {
    // Un Mock OPEN/lento debe observarse: se espera con Promise.race y un
    // limite corto en lugar de bloquear la prueba 15 s.
    let respuesta: any = null;

    try {
      const resultado = await this.circuito.ejecutar(async () => {
        const res = await this.mock.resolveResponse(fileName);
        respuesta = res;

        if (this.esFalloDeRed(res.status)) {
          throw new Error(`SUNAT no disponible (HTTP ${res.status})`);
        }
        return res;
      });

      return {
        ejecutado: resultado.ejecutado,
        httpStatus: respuesta?.status,
        estado: this.circuito.getState(),
      };
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return { ejecutado: false, estado: CircuitState.OPEN };
      }

      return {
        ejecutado: true,
        httpStatus: respuesta?.status,
        estado: this.circuito.getState(),
      };
    }
  }

  /** Segun la spec, un 503 es un fallo de red. El SOAP Fault (500) tambien. */
  private esFalloDeRed(status: number): boolean {
    return status === 503 || status === 500;
  }

  /** RUC que activa el modo 503 del catálogo oficial de fallos. */
  static readonly RUC_503 = '20111111112';

  /** Nombre de archivo con el RUC que inyecta el fallo. */
  static fileName(ruc: string, correlativo: number): string {
    return `${ruc}-01-F001-${correlativo}.zip`;
  }

  /** Modo de fallo esperado para el RUC 503 (solo documental). */
  static get modoFallo(): SunatFaultMode {
    return SunatFaultMode.SERVICE_UNAVAILABLE;
  }
}
