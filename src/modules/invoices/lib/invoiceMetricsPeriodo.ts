/**
 * Métricas de facturación del periodo (TA-69).
 *
 * Traduce `GET /api/v1/invoices/metrics` a lo que pinta la barra de resumen.
 *
 * POR QUÉ UN ARCHIVO APARTE Y NO DENTRO DE `invoiceMetrics.ts`
 *
 * `invoiceMetrics.ts` calcula los KPIs de la CONSOLA sobre los comprobantes que
 * el navegador ya tiene. Esas fórmulas (`ResumenFiscal`) nacieron para la
 * pantalla de emisión y tienen campos que el backend no devuelve: tiempos de
 * despacho, desglose por tipo. Mezclar ambos aquí obligaría a mantener dos
 * contratos en un solo tipo.
 *
 * Este archivo es solo el contrato del endpoint de periodo, más el formateo que
 * necesita el usuario.
 */

/** Respuesta de `GET /api/v1/invoices/metrics`. */
export interface MetricasFacturacion {
  /** Total de documentos registrados en el período, incluidos todos los estados. */
  total?: number;
  /** Comprobantes emitidos en el periodo, sin contar los rechazados. */
  emitidos: number;
  /** Rechazados por SUNAT en el periodo. */
  rechazados: number;
  /** Aceptados u observados. */
  aceptados: number;
  /** En cola, todavía sin respuesta de SUNAT. */
  pendientes: number;
  /**
   * Comprobantes que no pudieron enviarse por un fallo de comunicación.
   *
   * NO son "pendientes": un pendiente espera respuesta, un error de red es un
   * envío que falló. Su importe queda FUERA de `facturado*`. Puede venir
   * ausente si el backend es anterior al campo; se asume 0.
   */
  erroresRed: number;
  /** Importe neto: bruto menos notas de crédito. */
  facturado: number;
  /** Importe bruto, sin descontar notas de crédito. */
  facturadoBruto: number;
  /** Importe acreditado por notas de crédito. */
  acreditado: number;
  /** Importe bruto de las notas de débito. */
  debitado: number;
  /** Porcentaje de aceptación sobre lo procesado. */
  tasaAceptacion: number;
  /** Periodo consultado, YYYY-MM. */
  periodo: string;
}

/** Valores neutros para el primer render, antes de que responda el backend. */
export const METRICAS_VACIAS: MetricasFacturacion = {
  emitidos: 0,
  rechazados: 0,
  aceptados: 0,
  pendientes: 0,
  erroresRed: 0,
  facturado: 0,
  facturadoBruto: 0,
  acreditado: 0,
  debitado: 0,
  tasaAceptacion: 0,
  periodo: '',
};

/**
 * Periodo actual en formato YYYY-MM.
 *
 * Se calcula con la fecha LOCAL y no con `toISOString()`: en Lima (UTC-5) el
 * 31 de octubre a las 20:00 ya es 1 de noviembre en UTC, así que
 * `toISOString()` devolvería el mes siguiente y la pantalla mostraría las
 * métricas del mes que todavía no empezó. Es el mismo defecto que se corrigió
 * en la fecha de emisión del M1.
 */
export const periodoActual = (ahora: Date = new Date()): string => {
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}`;
};

/** ¿La cadena tiene forma de periodo YYYY-MM? */
export const esPeriodoValido = (periodo: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test((periodo ?? '').trim());

/**
 * Normaliza lo que llegue del backend.
 *
 * Un campo que no viaja se queda en 0 en lugar de `undefined`, porque un
 * `undefined` en un `formatCurrency` pinta "NaN" en la pantalla y el usuario
 * leería una cifra rota en medio de la demostración.
 */
export const normalizarMetricas = (
  crudo: Partial<MetricasFacturacion> | null | undefined,
  periodo: string = periodoActual(),
): MetricasFacturacion => {
  const numero = (valor: unknown): number => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    total: crudo?.total == null ? undefined : numero(crudo.total),
    emitidos: numero(crudo?.emitidos),
    rechazados: numero(crudo?.rechazados),
    aceptados: numero(crudo?.aceptados),
    pendientes: numero(crudo?.pendientes),
    erroresRed: numero(crudo?.erroresRed),
    facturado: numero(crudo?.facturado),
    facturadoBruto: numero(crudo?.facturadoBruto),
    acreditado: numero(crudo?.acreditado),
    debitado: numero(crudo?.debitado),
    tasaAceptacion: numero(crudo?.tasaAceptacion),
    periodo: (crudo?.periodo ?? '').trim() || periodo,
  };
};

/**
 * Comprueba una coherencia que delata un error del backend.
 *
 * El importe neto debe ser `bruto - acreditado`: el bruto del servidor ya
 * incluye el débito. Si no cuadra al céntimo, algo se calculó dos veces. Se devuelve el booleano y no
 * se corrige la cifra: la pantalla debe mostrar lo que el servidor dijo, y esta
 * función existe para que una prueba lo detecte antes de la demostración.
 */
export const metricasCuadran = (m: MetricasFacturacion): boolean => {
  const esperado = Math.round((m.facturadoBruto - m.acreditado) * 100) / 100;
  return Math.abs(esperado - m.facturado) < 0.011;
};
