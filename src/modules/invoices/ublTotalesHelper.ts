import { redondearMoneda as centimos } from './money';
/**
 * Cálculo de detracción, retención, ICBPER e importe a pagar (M1).
 *
 * Se separa de `ublGeneratorService` para que ese archivo contenga solo el
 * ensamblado del XML y respete el límite de líneas del proyecto.
 *
 * TA-62 amplía el cálculo: antes solo existía `montoGravado` y `montoIgv`, así
 * que una operación exonerada, inafecta o de exportación llegaba a cero. Ahora
 * el desglose sale de las LÍNEAS cuando están presentes, porque cada una puede
 * tener una afectación distinta y el comprobante debe declararlas separadas.
 */
import { aplicarDescuentoGlobal, type DescuentoGlobal } from './application/services/descuentoGlobal';
import {
  MONTO_ICBPER_POR_BOLSA,
  TASA_IGV,
  TASA_RETENCION_IGV,
} from './sunatCatalogs';
import {
  esAfectacionGratuita,
  porcentajeDetraccion,
  superaUmbralDetraccion,
  tributoDeAfectacion,
} from './sunatCatalogsQuery';

export interface TotalesCalculados {
  /** Base imponible del IGV (afectaciones gravadas onerosas). */
  gravado: number;
  igv: number;
  /** Base de las afectaciones exoneradas (20, 21). */
  exonerado: number;
  /** Base de las afectaciones inafectas (30-37). */
  inafecto: number;
  /** Base de la exportación (40). */
  exportado: number;
  detraccion: number;
  retencion: number;
  icbper: number;
  total: number;
  importePagar: number;
  otrosDescuentos?: number;
  baseDescuentoGlobal?: number;
}

/**
 * Línea mínima para el cálculo tributario.
 *
 * No se usa `LineaDetalle` de `xmlNodesHelper` para no acoplar el cálculo al
 * formateo del XML: aquí solo importa la naturaleza tributaria y los importes.
 */
export interface LineaTributaria {
  afectacion: string;
  /** Valor de venta de la línea SIN IGV y ya con descuentos. */
  valorVenta: number;
  igv: number;
  /** Importe del ICBPER de la línea, si es una bolsa plástica. */
  icbper?: number;
}

/** Datos mínimos del comprobante necesarios para liquidar los tributos. */
export interface DatosTributarios {
  tipoMoneda?: string;
  montoGravado: number;
  montoIgv: number;
  montoTotal: number;
  /** El monto total ya incorpora el ICBPER de las líneas. */
  montoTotalIncluyeIcbper?: boolean;
  codigoDetraccion?: string;
  montoDetraccion?: number;
  montoRetencion?: number;
  bolsasIcBper?: number;
  otrosDescuentos?: number;
  descuentoGlobal?: DescuentoGlobal | null;
  baseDescuentoGlobal?: number;
  /**
   * Detalle tributario por línea; si falta se usa el agregado de los montos.
   *
   * Se llama `lineasTributarias` y no `lineas` porque `InvoicePayload` ya
   * declara su propio `lineas: LineaDetalle[]` (la línea del XML, con
   * descripción y unidad). Dos campos homónimos con formas distintas en la
   * misma jerarquía de tipos rompen la compilación.
   */
  lineasTributarias?: LineaTributaria[];
}

/** Redondeo monetario a dos decimales sin arrastrar error flotante. */

/**
 * Reparte el valor de venta de las líneas entre las cuatro bases.
 *
 * Las gratuitas NO suman a ninguna base: por la regla 3278 su
 * `LineExtensionAmount` es cero, aunque hayan generado un IGV referencial que
 * sí se informa en su propia línea. Sumarlas al gravado declararía como venta
 * algo que no se cobró.
 */
function repartirBases(lineas: LineaTributaria[]): {
  gravado: number;
  exonerado: number;
  inafecto: number;
  exportado: number;
  igv: number;
  icbper: number;
} {
  let gravado = 0;
  let exonerado = 0;
  let inafecto = 0;
  let exportado = 0;
  let igv = 0;
  let icbper = 0;

  for (const linea of lineas) {
    const tributo = tributoDeAfectacion(linea.afectacion) ?? '1000';
    const gratuita = esAfectacionGratuita(linea.afectacion);
    const base = gratuita ? 0 : linea.valorVenta;

    if (tributo === '1000') {
      gravado += base;
      // En una gratuita gravada el IGV referencial se informa en la línea,
      // pero no se cobra: no entra al total a pagar.
      if (!gratuita) igv += linea.igv;
    } else if (tributo === '9997') {
      exonerado += base;
    } else if (tributo === '9998') {
      inafecto += base;
    } else if (tributo === '9995') {
      exportado += base;
    }

    if (!gratuita) icbper += linea.icbper ?? 0;
  }

  return {
    gravado: centimos(gravado),
    exonerado: centimos(exonerado),
    inafecto: centimos(inafecto),
    exportado: centimos(exportado),
    igv: centimos(igv),
    icbper: centimos(icbper),
  };
}

/**
 * Calcula los tributos del comprobante.
 *
 * La detracción solo se aplica si la operación declara un código del Catálogo
 * 54, la moneda es soles y el importe supera el umbral de S/ 700 (SPOT). El
 * monto se expresa con dos decimales.
 */
export const calcularTotales = (
  payload: DatosTributarios,
): TotalesCalculados => {
  const moneda = payload.tipoMoneda ?? 'PEN';
  const igvInformado = payload.montoIgv ?? 0;

  const conDetalle =
    payload.lineasTributarias && payload.lineasTributarias.length > 0;
  const originales = conDetalle
    ? repartirBases(payload.lineasTributarias!)
    : {
        // Sin detalle se respeta el comportamiento anterior: todo es gravado.
        gravado: payload.montoGravado ?? 0,
        exonerado: 0,
        inafecto: 0,
        exportado: 0,
        igv: igvInformado,
        icbper: payload.bolsasIcBper
          ? centimos(payload.bolsasIcBper * MONTO_ICBPER_POR_BOLSA)
          : 0,
      };

  const resultadoGlobal = aplicarDescuentoGlobal(originales, payload.descuentoGlobal, payload.otrosDescuentos ?? 0);
  const bases = resultadoGlobal.bases;
  const totalBase = payload.descuentoGlobal ? resultadoGlobal.total : (payload.montoTotal ?? bases.gravado + bases.igv);

  const icbperAdicional = payload.descuentoGlobal || payload.montoTotalIncluyeIcbper ? 0 : bases.icbper;

  const porcentaje = payload.codigoDetraccion
    ? porcentajeDetraccion(payload.codigoDetraccion)
    : null;

  const detraccion =
    payload.montoDetraccion ??
    (porcentaje !== null && moneda === 'PEN' && superaUmbralDetraccion(totalBase)
      ? centimos((totalBase + icbperAdicional) * porcentaje)
      : 0);

  const retencion = payload.montoRetencion ?? 0;

  const total = centimos(totalBase + icbperAdicional);
  const importePagar = centimos(total - detraccion - retencion);

  return {
    gravado: bases.gravado,
    igv: bases.igv,
    exonerado: bases.exonerado,
    inafecto: bases.inafecto,
    exportado: bases.exportado,
    detraccion,
    retencion,
    icbper: bases.icbper,
    total,
    importePagar,
    otrosDescuentos: resultadoGlobal.otrosDescuentos,
    baseDescuentoGlobal: resultadoGlobal.baseDescuento,
  };
};

/**
 * Importe de la retención del IGV para un agente de retención.
 * Se aplica sobre el total superior a S/ 700 y se redondea a céntimos.
 */
export const calcularRetencion = (importe: number): number => {
  if (centimos(importe) <= 700) return 0;
  return centimos(importe * TASA_RETENCION_IGV);
};

/** Tasa del IGV reexportada para que el generador no la importe por separado. */
export { TASA_IGV };

export { bloqueImpuestos, bloqueRetenciones, bloqueTotales } from './ublTaxBlocks';
