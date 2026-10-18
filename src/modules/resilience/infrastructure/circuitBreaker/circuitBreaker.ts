/**
 * Circuit Breaker de resiliencia (M2).
 *
 * Implementa la maquina de estados de `specs/m2_resilience.spec.md` §2.2:
 *
 *  - CLOSED: las peticiones fluyen. Al acumular `umbralFallos` errores
 *    consecutivos (HTTP 503 o timeouts) pasa inmediatamente a OPEN.
 *  - OPEN: se bloquea todo intento de red (fast-fail) durante una ventana de
 *    enfriamiento. Las facturas entrantes se guardan en el Outbox.
 *  - HALF-OPEN: transcurrida la ventana se permite exactamente 1 peticion de
 *    prueba. Si acierta -> CLOSED y contadores a cero; si falla -> OPEN por otra
 *    ventana.
 *
 * El reloj es inyectable para que las pruebas de caos puedan medir MTTD y MTTR
 * sin esperar los 30 s reales de enfriamiento.
 */

/** Estados posibles del circuito. */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF-OPEN',
}

/** Opciones del Circuit Breaker. */
export interface CircuitBreakerOptions {
  /** Fallos consecutivos antes de abrir el circuito (spec: 5). */
  umbralFallos?: number;
  /** Ventana de enfriamiento en OPEN, en milisegundos (spec: 30 s). */
  ventanaEnfriamientoMs?: number;
  /** Reloj inyectable; por defecto `Date.now`. */
  ahora?: () => number;
}

/** Resultado de intentar ejecutar una operacion a traves del circuito. */
export type CircuitResult<T> =
  | { ejecutado: true; valor: T }
  | { ejecutado: false; motivo: 'CIRCUIT_OPEN' };

/** Error lanzado cuando el circuito rechaza una peticion (fast-fail). */
export class CircuitOpenError extends Error {
  constructor() {
    super('El Circuit Breaker esta OPEN: peticion rechazada sin tocar la red');
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private estado: CircuitState = CircuitState.CLOSED;
  private fallosConsecutivos = 0;
  private abiertoEn = 0;
  private pruebaEnCurso = false;

  private readonly umbralFallos: number;
  private readonly ventanaEnfriamientoMs: number;
  private readonly ahora: () => number;

  constructor(opciones: CircuitBreakerOptions = {}) {
    this.umbralFallos = opciones.umbralFallos ?? 5;
    this.ventanaEnfriamientoMs = opciones.ventanaEnfriamientoMs ?? 30_000;
    this.ahora = opciones.ahora ?? Date.now;
  }

  /** Estado actual, aplicando la transicion temporal OPEN -> HALF-OPEN. */
  getState(): CircuitState {
    if (
      this.estado === CircuitState.OPEN &&
      this.ahora() - this.abiertoEn >= this.ventanaEnfriamientoMs
    ) {
      this.estado = CircuitState.HALF_OPEN;
      this.pruebaEnCurso = false;
    }
    return this.estado;
  }

  /** Fallos consecutivos acumulados en el ciclo actual. */
  getFallosConsecutivos(): number {
    return this.fallosConsecutivos;
  }

  /** Instante (epoch ms) en que el circuito paso a OPEN. */
  getAbiertoEn(): number {
    return this.abiertoEn;
  }

  /** Indica si una peticion seria rechazada ahora mismo (fast-fail). */
  estaBloqueando(): boolean {
    const estado = this.getState();

    if (estado === CircuitState.OPEN) return true;

    // En HALF-OPEN solo pasa una peticion de prueba a la vez.
    if (estado === CircuitState.HALF_OPEN) return this.pruebaEnCurso;

    return false;
  }

  /**
   * Ejecuta `operacion` si el circuito lo permite.
   *
   * Devuelve `{ ejecutado: false }` cuando se rechaza sin tocar la red, y
   * `{ ejecutado: true, valor }` cuando la operacion corrio. Los fallos se
   * propagan al llamador despues de registrarse en los contadores.
   */
  async ejecutar<T>(operacion: () => Promise<T>): Promise<CircuitResult<T>> {
    if (this.estaBloqueando()) {
      return { ejecutado: false, motivo: 'CIRCUIT_OPEN' };
    }

    const estabaEnSemiabierto = this.getState() === CircuitState.HALF_OPEN;
    if (estabaEnSemiabierto) {
      this.pruebaEnCurso = true;
    }

    try {
      const valor = await operacion();
      this.registrarExito();
      return { ejecutado: true, valor };
    } catch (error) {
      this.registrarFallo();
      throw error;
    } finally {
      this.pruebaEnCurso = false;
    }
  }

  /** Registra un exito: en HALF-OPEN cierra el circuito y reinicia contadores. */
  registrarExito(): void {
    this.fallosConsecutivos = 0;
    this.estado = CircuitState.CLOSED;
    this.pruebaEnCurso = false;
  }

  /** Registra un fallo y abre el circuito al alcanzar el umbral. */
  registrarFallo(): void {
    const estabaEnSemiabierto = this.getState() === CircuitState.HALF_OPEN;

    this.fallosConsecutivos += 1;

    // Un fallo en HALF-OPEN reabre el circuito de inmediato (spec §2.2).
    if (estabaEnSemiabierto || this.fallosConsecutivos >= this.umbralFallos) {
      this.abrir();
    }
  }

  /** Fuerza el estado OPEN y reinicia la ventana de enfriamiento. */
  abrir(): void {
    this.estado = CircuitState.OPEN;
    this.abiertoEn = this.ahora();
    this.pruebaEnCurso = false;
  }

  /** Reinicia el circuito a su estado inicial (utilidad para pruebas). */
  reiniciar(): void {
    this.estado = CircuitState.CLOSED;
    this.fallosConsecutivos = 0;
    this.abiertoEn = 0;
    this.pruebaEnCurso = false;
  }
}
