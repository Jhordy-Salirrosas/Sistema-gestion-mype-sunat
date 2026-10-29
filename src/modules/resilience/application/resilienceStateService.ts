import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreaker,
  CircuitState,
} from '../infrastructure/circuitBreaker/circuitBreaker';
import { SunatFaultMode } from '../infrastructure/mock/sunat-fault-injection.fixtures';
import { ChaosScenarioDto } from './dto/chaosScenarioDto';

/** Estados que espera el frontend en `CircuitBreakerMetrics.state`. */
export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Forma exacta de `CircuitBreakerMetrics` en el frontend. */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerStatus;
  failureRate: number;
  slowCallRate: number;
  bufferedInvoicesCount: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastStateChange: string;
}

/**
 * Estado en memoria de la resiliencia del sistema (M2).
 *
 * Reune las tres cosas que el frontend necesita y que no existian:
 *
 *  1. Una instancia viva del `CircuitBreaker` (hasta ahora la clase no se
 *     instanciaba en ningun sitio).
 *  2. Los contadores de llamadas a SUNAT (`total`, `exitosas`, `fallidas`).
 *  3. El escenario de caos activo, que el Inyector de Fallos consulta antes de
 *     resolver el modo por RUC.
 *
 * Los contadores se alimentan desde `SunatMockService.resolveResponse`, que es
 * por donde pasan todas las llamadas simuladas a SUNAT. Cuando se conecte el
 * cliente SOAP real, el `record*` se mueve a `SunatBillService`.
 */
@Injectable()
export class ResilienceStateService {
  private readonly logger = new Logger(ResilienceStateService.name);

  private readonly breaker = new CircuitBreaker();

  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private slowCalls = 0;

  private estadoPrevio: CircuitState = CircuitState.CLOSED;
  private lastStateChange = new Date().toISOString();

  private chaos: ChaosScenarioDto | null = null;

  /** Registra una llamada exitosa a SUNAT. */
  recordSuccess(): void {
    this.totalCalls += 1;
    this.successfulCalls += 1;
    this.breaker.registrarExito();
    this.sincronizarEstado();
  }

  /** Registra una llamada fallida a SUNAT (5xx o timeout). */
  recordFailure(): void {
    this.totalCalls += 1;
    this.failedCalls += 1;
    this.breaker.registrarFallo();
    this.sincronizarEstado();
  }

  /** Registra una llamada lenta (modo SLOW), que cuenta como exitosa. */
  recordSlow(): void {
    this.totalCalls += 1;
    this.successfulCalls += 1;
    this.slowCalls += 1;
    this.breaker.registrarExito();
    this.sincronizarEstado();
  }

  /**
   * Indica si el Circuit Breaker permite llamar a SUNAT ahora.
   *
   * `false` en OPEN (ventana de enfriamiento) o en HALF-OPEN cuando ya hay una
   * peticion de prueba en curso. El worker debe dejar el job en cola cuando
   * recibe `false`: no se toca la red y no se consume un intento del backoff.
   */
  puedeEnviar(): boolean {
    return !this.breaker.estaBloqueando();
  }

  /**
   * Reserva el envío. En HALF-OPEN garantiza que solo una petición de prueba
   * pase a la vez; en CLOSED no limita y en OPEN rechaza.
   */
  reservarEnvio(): boolean {
    return this.breaker.reservarPeticion();
  }

  /** Libera la reserva cuando el envío termina sin un resultado clasificable. */
  liberarEnvio(): void {
    this.breaker.liberarPeticion();
  }

  /**
   * Alimenta el circuito con el resultado de un envio real a SUNAT.
   *
   * `falloRed = true` para red, timeout, 5xx o CDR ilegible (resultados
   * reintentables); `false` para un CDR de negocio, que demuestra que SUNAT
   * esta respondiendo y reinicia los fallos consecutivos.
   */
  registrarResultadoEnvio(falloRed: boolean): void {
    if (falloRed) {
      this.recordFailure();
    } else {
      this.recordSuccess();
    }
  }

  /** Detecta el cambio de estado del circuito para sellar `lastStateChange`. */
  private sincronizarEstado(): void {
    const actual = this.breaker.getState();
    if (actual !== this.estadoPrevio) {
      this.estadoPrevio = actual;
      this.lastStateChange = new Date().toISOString();
      this.logger.log(`Circuit Breaker paso a ${actual}`);
    }
  }

  /**
   * Modo de fallo forzado por el escenario de caos, o null si no hay caos.
   * `SunatMockService` lo consulta antes de resolver el modo por RUC.
   */
  getForcedFaultMode(): SunatFaultMode | null {
    if (!this.chaos) return null;
    if (this.chaos.simulateSunatDown) return SunatFaultMode.SERVICE_UNAVAILABLE;
    if (this.chaos.simulateHighLatency) return SunatFaultMode.SLOW;
    return null;
  }

  /** Activa el escenario de caos. */
  setChaos(dto: ChaosScenarioDto): ChaosScenarioDto {
    this.chaos = dto;
    this.logger.warn(
      `Modo caos activado: sunatDown=${dto.simulateSunatDown} highLatency=${dto.simulateHighLatency} latencyMs=${dto.latencyMs ?? 'por defecto'}`,
    );
    return dto;
  }

  /** Desactiva el caos y vuelve al comportamiento normal del Mock. */
  clearChaos(): void {
    this.chaos = null;
    this.logger.log('Modo caos desactivado');
  }

  /** Escenario activo, o null. */
  getChaos(): ChaosScenarioDto | null {
    return this.chaos;
  }

  /**
   * Foto de las metricas para `GET /api/v1/resilience/metrics`.
   * `bufferedInvoicesCount` lo aporta la cola de pg-boss.
   */
  snapshot(bufferedInvoicesCount: number): CircuitBreakerMetrics {
    const estado = this.breaker.getState();
    const porcentaje = (n: number): number =>
      this.totalCalls === 0 ? 0 : Math.round((n * 100) / this.totalCalls);

    return {
      state:
        estado === CircuitState.HALF_OPEN
          ? 'HALF_OPEN'
          : (estado as CircuitBreakerStatus),
      failureRate: porcentaje(this.failedCalls),
      slowCallRate: porcentaje(this.slowCalls),
      bufferedInvoicesCount,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      lastStateChange: this.lastStateChange,
    };
  }
}
