/**
 * Detracción SPOT (Catálogo 54), Retención del IGV (3%) y liquidación integral.
 *
 * Reglas según el informe técnico del proyecto:
 *  - La detracción aplica cuando el total en Soles supera S/ 700.00 y el monto
 *    del comprobante se expresa a céntimos. Aunque la factura se emita
 *    en USD, se expresa siempre en Soles usando el tipo de cambio venta SBS.
 *  - La retención del 3% aplica a clientes Agentes de Retención sobre el
 *    importe total cuando la operación supera el umbral.
 *  - El monto neto pendiente de pago descuenta detracción y retención; la suma
 *    de las cuotas al crédito debe ser exactamente ese neto.
 *
 * Se reexporta desde `./invoiceCalculations`. TypeScript puro sin dependencias
 * de React ni de red.
 */
import {
  round2,
  igvDesdeBase,
  calcularIcbper,
  sumarPorAfectacion,
  type LineaComprobante,
} from './invoiceTaxes';

/** Factor de retención del IGV para clientes designados Agentes de Retención. */
export const RETENCION_IGV_RATE = 0.03;

/** Umbral en Soles a partir del cual la operación puede estar sujeta a SPOT/retención. */
export const UMBRAL_SOLES = 700;

/**
 * Redondea el depósito de detracción al entero más cercano.
 * Ej.: S/ 141.60 -> S/ 142.00.
 */
export const roundDetraccion = (num: number): number => {
  return Math.round(num + Number.EPSILON);
};

/** Desglose tributario completo de un comprobante. */
export interface LiquidacionComprobante {
  opGravada: number;
  opExonerada: number;
  opInafecta: number;
  opGratuita: number;
  /** IGV calculado únicamente sobre las operaciones gravadas. */
  igv: number;
  /** Importe total del comprobante (PayableAmount). */
  importeTotal: number;
  /** Monto de la retención del IGV (0 si no aplica). */
  montoRetencion: number;
  /** Monto de la detracción SPOT en Soles (0 si no aplica). */
  montoDetraccion: number;
  /** Monto neto que el cliente paga efectivamente al proveedor. */
  netoPendientePago: number;
}

/** Opciones tributarias que acompañan a la liquidación. */
export interface OpcionesLiquidacion {
  /** Número de bolsas plásticas gravadas con ICBPER. */
  bolsasPlasticas?: number;
  /** Indica si el cliente es Agente de Retención del IGV. */
  esAgenteRetencion?: boolean;
  /** Porcentaje de detracción (ej. 0.12 para 12%); 0 u omitido si no aplica. */
  detraccionPorcentaje?: number;
  /** Tipo de cambio SBS venta cuando el comprobante se emite en USD. */
  tipoCambio?: number;
}
/**
 * Calcula el monto de la detracción SPOT.
 *
 * El requisito de umbral se evalúa sobre el total expresado en Soles. El monto
 * del comprobante se expresa a céntimos; el depósito se redondea aparte.
 */
export const calcularDetraccion = (
  importeTotal: number,
  porcentaje: number,
  tipoCambio = 1,
): number => {
  if (!porcentaje || porcentaje <= 0) return 0;

  const totalEnSoles = round2(importeTotal * tipoCambio);
  if (totalEnSoles <= UMBRAL_SOLES) return 0;

  return round2(totalEnSoles * porcentaje);
};

/**
 * Calcula el monto de la retención del IGV (3%).
 *
 * Aplica solo para clientes Agentes de Retención cuando el importe total supera
 * el umbral de S/ 700.00.
 */
export const calcularRetencion = (
  importeTotal: number,
  esAgenteRetencion: boolean,
  tipoCambio = 1,
  montoDetraccion = 0,
): number => {
  if (!esAgenteRetencion || montoDetraccion > 0) return 0;

  const totalEnSoles = round2(importeTotal * tipoCambio);
  if (totalEnSoles <= UMBRAL_SOLES) return 0;

  return round2(importeTotal * RETENCION_IGV_RATE);
};

/**
 * Liquida un comprobante completo: desglose por afectación, IGV, ICBPER,
 * detracción, retención y neto pendiente de pago.
 */
export const liquidarComprobante = (
  lineas: readonly LineaComprobante[],
  opciones: OpcionesLiquidacion = {},
): LiquidacionComprobante => {
  const opGravada = sumarPorAfectacion(lineas, 'GRAVADA');
  const opExonerada = sumarPorAfectacion(lineas, 'EXONERADA');
  const opInafecta = sumarPorAfectacion(lineas, 'INAFECTA');
  const opGratuita = sumarPorAfectacion(lineas, 'GRATUITA');

  const igv = igvDesdeBase(opGravada);
  const icbper = calcularIcbper(opciones.bolsasPlasticas ?? 0);

  // Las operaciones gratuitas no generan cobro al cliente.
  const importeTotal = round2(opGravada + opExonerada + opInafecta + igv + icbper);

  const tipoCambio = opciones.tipoCambio ?? 1;
  const montoDetraccion = calcularDetraccion(
    importeTotal,
    opciones.detraccionPorcentaje ?? 0,
    tipoCambio,
  );
  const montoRetencion = calcularRetencion(
    importeTotal,
    opciones.esAgenteRetencion ?? false,
    tipoCambio,
    montoDetraccion,
  );

  // SPOT efectivo excluye la retención IGV; solo un régimen reduce el neto.
  const netoPendientePago = round2(importeTotal - montoDetraccion - montoRetencion);

  return {
    opGravada,
    opExonerada,
    opInafecta,
    opGratuita,
    igv,
    importeTotal,
    montoRetencion,
    montoDetraccion,
    netoPendientePago,
  };
};
