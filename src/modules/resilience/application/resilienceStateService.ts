import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreaker,
  CircuitState,
} from '../infrastructure/circuitBreaker/circuitBreaker';
import { SunatFaultMode } from '../infrastructure/mock/sunat-fault-injection.fixtures';
import { ChaosScenarioDto } from './dto/chaosScenarioDto';

/** Estados operativos posibles del circuito. */
export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerStatus;
  lastStateChange: string;
  circuitBreakerScope: 'global';
}

/**
 * Estado global del Circuit Breaker y del escenario de caos (M2).
 * La actividad del Dashboard SIRE se consulta por separado desde PostgreSQL.
 */
@Injectable()
export class ResilienceStateService {
  private readonly logger = new Logger(ResilienceStateService.name);

  private readonly breaker = new CircuitBreaker();

  private estadoPrevio: CircuitState = CircuitState.CLOSED;
  private lastStateChange = new Date().toISOString();

  private chaos: ChaosScenarioDto | null = null;

  /** Registra una llamada exitosa a SUNAT. */
  recordSuccess(): void {
    this.breaker.registrarExito();
    this.sincronizarEstado();
  }

  /** Registra una llamada fallida a SUNAT (5xx o timeout). */
  recordFailure(): void {
    this.breaker.registrarFallo();
    this.sincronizarEstado();
  }

  /** Registra una llamada lenta (modo SLOW), que cuenta como exitosa. */
  recordSlow(): void {
    this.breaker.registrarExito();
    this.sincronizarEstado();
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

  /** Estado del circuito compartido, sin métricas de actividad por empresa. */
  snapshot(): CircuitBreakerSnapshot {
    this.sincronizarEstado();
    const estado = this.breaker.getState();

    return {
      state:
        estado === CircuitState.HALF_OPEN
          ? 'HALF_OPEN'
          : (estado as CircuitBreakerStatus),
      lastStateChange: this.lastStateChange,
      circuitBreakerScope: 'global',
    };
  }
}
