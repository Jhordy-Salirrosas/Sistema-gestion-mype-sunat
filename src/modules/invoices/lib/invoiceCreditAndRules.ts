/**
 * Reglas normativas SUNAT del módulo M1: cronograma de cuotas al crédito,
 * plazo de envío y trama QR del CPE.
 *
 * Cubre las Resoluciones de Superintendencia N.° 193-2020/SUNAT (cuotas y
 * retenciones), N.° 123-2022/SUNAT y N.° 000003-2023/SUNAT (plazo de envío).
 *
 * El importe en letras vive en `./invoiceAmountInWords`. TypeScript puro: sin
 * React ni red. Se reexporta desde `./invoiceCalculations`.
 */
import { round2 } from './invoiceTaxes';
import type { CuotaDemo, TipoComprobante } from '../data/invoiceDemoTypes';

export { montoEnLetrasSunat } from './invoiceAmountInWords';

/** Resultado de la validación del plazo de envío a SUNAT. */
export interface ResultadoPlazoEnvio {
  diasTranscurridos: number;
  diasMaximos: number;
  dentroDePlazo: boolean;
  estadoPlazo: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
}

/** Diferencia en días calendario entre dos fechas ISO (YYYY-MM-DD). */
const diasEntre = (desde: string, hasta: string): number => {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

/**
 * Genera el cronograma de cuotas de un crédito.
 *
 * El neto ya debe venir descontado de la detracción SPOT y la retención del
 * 3%. La última cuota absorbe la diferencia de céntimos para que la suma sea
 * exactamente el neto (evita el error SUNAT 3267).
 */
export const generarCronogramaCuotas = (
  netoPendientePago: number,
  numeroCuotas: number,
  fechaEmision: string,
  diasEntreCuotas = 30,
): readonly CuotaDemo[] => {
  if (netoPendientePago <= 0 || numeroCuotas <= 0) return [];

  const montoCuota = round2(netoPendientePago / numeroCuotas);
  const fecha = new Date(`${fechaEmision}T00:00:00Z`);

  return Array.from({ length: numeroCuotas }, (_, i) => {
    const esUltima = i === numeroCuotas - 1;
    const monto = esUltima
      ? round2(netoPendientePago - montoCuota * (numeroCuotas - 1))
      : montoCuota;
    const vencimiento = new Date(fecha);
    vencimiento.setUTCDate(
      vencimiento.getUTCDate() + diasEntreCuotas * (i + 1),
    );
    return {
      numero: `Cuota${String(i + 1).padStart(3, '0')}`,
      monto,
      vencimiento: vencimiento.toISOString().slice(0, 10),
    };
  });
};

/**
 * Valida el plazo máximo de envío a SUNAT (RS N.° 000003-2023/SUNAT).
 *
 * Facturas y notas vinculadas: 3 días calendario desde el día siguiente a la
 * emisión. Resúmenes diarios (RC) y comunicaciones de baja (RA): 7 días.
 */
export const validarPlazoEnvioSunat = (
  fechaEmision: string,
  fechaReferencia: string,
  tipo: TipoComprobante,
): ResultadoPlazoEnvio => {
  const diasMaximos = tipo === 'RC' || tipo === 'RA' ? 7 : 3;
  const dif = diasEntre(fechaEmision, fechaReferencia);

  // El plazo corre desde el día siguiente a la emisión.
  const diasTranscurridos = Math.max(0, dif - 1);

  const dentroDePlazo = diasTranscurridos <= diasMaximos;
  const estadoPlazo: ResultadoPlazoEnvio['estadoPlazo'] = !dentroDePlazo
    ? 'VENCIDO'
    : diasTranscurridos >= diasMaximos
      ? 'POR_VENCER'
      : 'VIGENTE';

  return { diasTranscurridos, diasMaximos, dentroDePlazo, estadoPlazo };
};

/** Parámetros de la trama QR oficial del CPE. */
export interface ParametrosTramaQr {
  rucEmisor: string;
  tipo: string;
  serie: string;
  correlativo: number;
  igv: number;
  total: number;
  fecha: string;
  tipoDocCliente: string;
  numDocCliente: string;
  hashCpe: string;
}

/**
 * Genera la trama QR de 10 campos que exige SUNAT en la representación impresa.
 * Formato: ruc|tipo|serie|correlativo|igv|total|fecha|tipoDoc|numDoc|hash|
 */
export const generarTramaQrSunat = (p: ParametrosTramaQr): string => {
  return [
    p.rucEmisor,
    p.tipo,
    p.serie,
    String(p.correlativo),
    p.igv.toFixed(2),
    p.total.toFixed(2),
    p.fecha,
    p.tipoDocCliente,
    p.numDocCliente,
    p.hashCpe,
    '',
  ].join('|');
};
