/**
 * Cálculo de detracción, retención, ICBPER e importe a pagar (M1).
 *
 * Se separa de `ublGeneratorService` para que ese archivo contenga solo el
 * ensamblado del XML y respete el límite de líneas del proyecto.
 */
import {
  MONTO_ICBPER_POR_BOLSA,
  TASA_RETENCION_IGV,
} from './sunatCatalogs';
import {
  porcentajeDetraccion,
  superaUmbralDetraccion,
} from './sunatCatalogsQuery';

export interface TotalesCalculados {
  gravado: number;
  igv: number;
  detraccion: number;
  retencion: number;
  icbper: number;
  total: number;
  importePagar: number;
}

/** Datos mínimos del comprobante necesarios para liquidar los tributos. */
export interface DatosTributarios {
  tipoMoneda?: string;
  montoGravado: number;
  montoIgv: number;
  montoTotal: number;
  codigoDetraccion?: string;
  montoDetraccion?: number;
  montoRetencion?: number;
  bolsasIcBper?: number;
}

/**
 * Calcula los tributos del comprobante.
 *
 * La detracción solo se aplica si la operación declara un código del Catálogo
 * 54, la moneda es soles y el importe supera el umbral de S/ 700 (SPOT). El
 * monto se redondea al entero, como exige SUNAT.
 */
export const calcularTotales = (
  payload: DatosTributarios,
): TotalesCalculados => {
  const moneda = payload.tipoMoneda ?? 'PEN';
  const gravado = payload.montoGravado ?? 0;
  const igv = payload.montoIgv ?? 0;
  const totalBase = payload.montoTotal ?? gravado + igv;

  const porcentaje = payload.codigoDetraccion
    ? porcentajeDetraccion(payload.codigoDetraccion)
    : null;

  const detraccion =
    payload.montoDetraccion ??
    (porcentaje !== null && moneda === 'PEN' && superaUmbralDetraccion(totalBase)
      ? Math.round(totalBase * porcentaje)
      : 0);

  const retencion = payload.montoRetencion ?? 0;
  const icbper = payload.bolsasIcBper
    ? Math.round(payload.bolsasIcBper * MONTO_ICBPER_POR_BOLSA * 100) / 100
    : 0;

  const total = Math.round((totalBase + icbper) * 100) / 100;
  const importePagar =
    Math.round((total - detraccion - retencion) * 100) / 100;

  return { gravado, igv, detraccion, retencion, icbper, total, importePagar };
};

/**
 * Importe de la retención del IGV para un agente de retención.
 * SUNAT exige que se redondee al entero superior en soles.
 */
export const calcularRetencion = (importe: number): number => {
  if (importe <= 0) return 0;
  return Math.ceil(importe * TASA_RETENCION_IGV);
};

export { bloqueImpuestos, bloqueRetenciones, bloqueTotales } from './ublTaxBlocks';
