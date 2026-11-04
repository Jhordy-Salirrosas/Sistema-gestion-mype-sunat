/**
 * Importe en letras para la Leyenda 2006 (M1).
 *
 * SUNAT exige esta leyenda cuando el comprobante lleva detracción y lo deja con
 * la observación 4265 si falta:
 *
 *   "4265 - El XML no contiene el codigo de leyenda 2006 para tipo de operación
 *    de detracciones"
 *
 * El generador ya sabía emitir el bloque, pero solo si el payload traía
 * `montoEnLetras`, y nadie lo calculaba: todas las facturas con detracción
 * salían ACEPTADAS_CON_OBSERVACIONES. Se descubrió leyendo el CDR descargado.
 */
import { describe, expect, it } from '@jest/globals';
import { importeEnLetras } from '../../../src/modules/invoices/application/services/importeEnLetras';

describe('importeEnLetras — Leyenda 2006', () => {
  // Los importes del caso real: la factura con detracción del 31-10.
  it('convierte el importe real de una factura con detracción', () => {
    expect(importeEnLetras(1046.66)).toBe(
      'MIL CUARENTA Y SEIS CON 66/100 SOLES',
    );
  });

  it('el ejemplo de la especificación de SUNAT', () => {
    expect(importeEnLetras(1180)).toBe('MIL CIENTO OCHENTA CON 00/100 SOLES');
  });

  it.each([
    [0, 'CERO CON 00/100 SOLES'],
    [1, 'UNO CON 00/100 SOLES'],
    [15, 'QUINCE CON 00/100 SOLES'],
    [21, 'VEINTIUNO CON 00/100 SOLES'],
    [100, 'CIEN CON 00/100 SOLES'],
    [101, 'CIENTO UNO CON 00/100 SOLES'],
    [500, 'QUINIENTOS CON 00/100 SOLES'],
    [1000, 'MIL CON 00/100 SOLES'],
    [2000, 'DOS MIL CON 00/100 SOLES'],
    [100000, 'CIEN MIL CON 00/100 SOLES'],
    [1000000, 'UN MILLON CON 00/100 SOLES'],
  ])('convierte %s a "%s"', (importe, esperado) => {
    expect(importeEnLetras(importe)).toBe(esperado);
  });

  /**
   * Los céntimos se redondean antes de partir el importe: sin eso, 99.999 da
   * "CON 100/100", que no existe.
   */
  it('redondea los céntimos en lugar de dar 100/100', () => {
    expect(importeEnLetras(99.999)).toBe('CIEN CON 00/100 SOLES');
  });

  it('un importe negativo no produce texto raro', () => {
    expect(importeEnLetras(-5)).toBe('CERO CON 00/100 SOLES');
  });
});
