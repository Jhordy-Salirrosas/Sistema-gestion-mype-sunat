/**
 * Ventas del Módulo M1 vistas por el SIRE (TA-69).
 *
 * QUÉ FALTABA
 *
 * El SIRE concilia la propuesta de SUNAT contra los comprobantes que el sistema
 * cree haber emitido. Hasta ahora esa conciliación solo veía lo que entraba
 * por el módulo SIRE, así que las facturas y boletas emitidas por el M1 eran
 * **invisibles**: SUNAT las informaba como propias y el sistema no las
 * encontraba, o al contrario. El resultado era un falso `OMISION_LOCAL` en cada
 * período que tuviera ventas del M1, que es justamente el módulo que se está
 * entregando.
 *
 * QUÉ DECIDE ESTE ARCHIVO, Y POR QUÉ CADA COSA
 *
 *  1. **Solo los comprobantes ACEPTADOS (y OBSERVADOS) entran.** Un rechazado
 *     no existe ante SUNAT: incluirlo generaría un `OMISION_SUNAT` que el
 *     usuario no puede resolver, porque no hay nada que SUNAT deba informar.
 *  2. **Las Notas de Crédito restan y las de Débito suman.** El registro de
 *     ventas las informa con su propio signo; sumarlas todas inflaría la venta.
 *  3. **El CAR solo viaja en las boletas.** El Registro de Ventas lo pide
 *     únicamente cuando la boleta se cobró por una entidad recaudadora; una
 *     factura nunca lo lleva. Se usa `sireCarService` para calcularlo y, si no
 *     se puede, se deja vacío en lugar de inventar 27 dígitos.
 *  4. **La base imponible se deriva del total y el IGV**, igual que en el
 *     builder de resúmenes, para que ambas cifras cuadren al céntimo.
 *
 * Este archivo es puro a propósito: recibe las filas ya cargadas y no toca
 * Prisma. Así la conversión se puede probar sin base de datos, que es donde se
 * concentran los errores de signo y de redondeo.
 */
import { construirCar, esCarValido } from './sireCarService';

/** Fila mínima de una Invoice persistida que necesita esta conversión. */
export interface VentaM1 {
  id: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  estado: string;
  total: number;
  igv: number;
  /** Documento del cliente, cuando la boleta se cobró por recaudadora. */
  rucRecaudador?: string | null;
  numeroOperacion?: string | null;
  /** Moneda del comprobante, PEN por defecto. */
  moneda?: string | null;
}

/** Registro tal como lo consume la conciliación del SIRE. */
export interface RegistroParaSire {
  emitterRuc: string;
  documentType: string;
  series: string;
  correlative: string;
  taxableBase: number;
  igvAmount: number;
  totalAmount: number;
  /** CAR de 27 dígitos; cadena vacía cuando no aplica. */
  carSunat: string;
}

/** Estados que existen ante SUNAT y, por tanto, concilian. */
export const ESTADOS_QUE_CONCILIAN: readonly string[] = ['ACEPTADO', 'OBSERVADO'];

/** Tipos que restan del total (Notas de Crédito). */
export const TIPOS_QUE_RESTAN: readonly string[] = ['07'];

/** Tipos que suman (facturas, boletas y notas de débito). */
export const TIPOS_QUE_SUMAN: readonly string[] = ['01', '03', '08'];

/** Céntimos, para que base + IGV cuadre con el total. */
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Correlativo a 8 dígitos, como lo escribe el PLE. */
export const correlativoSire = (correlativo: number): string =>
  String(correlativo).padStart(8, '0');

/**
 * ¿Esta venta entra en la conciliación del SIRE?
 *
 * Se excluyen también las Notas de Débito y Crédito que no sean de serie B:
 * una nota a una factura no va en el Registro de Ventas de boletas, y meterla
 * allí descuadra las dos columnas.
 */
export const conciliaEnSire = (venta: VentaM1): boolean => {
  if (!ESTADOS_QUE_CONCILIAN.includes(venta.estado)) return false;
  if (!TIPOS_QUE_SUMAN.includes(venta.tipoComprobante) &&
      !TIPOS_QUE_RESTAN.includes(venta.tipoComprobante)) {
    return false;
  }
  return true;
};

/**
 * CAR de la venta, o cadena vacía.
 *
 * Devuelve cadena vacía —y no lanza— porque la conciliación no debe romperse
 * porque una boleta antigua no tenga el dato del recaudador: un CAR ausente se
 * ve como columna vacía, que es exactamente lo que el usuario tiene que
 * completar. Lo que sí se hace es no inventarlo.
 */
export const carDeVenta = (venta: VentaM1): string => {
  // Solo las boletas y sus notas llevan CAR.
  const llevaCar = ['03', '07', '08'].includes(venta.tipoComprobante);
  if (!llevaCar) return '';

  const ruc = (venta.rucRecaudador ?? '').trim();
  const operacion = (venta.numeroOperacion ?? '').trim();
  if (!ruc || !operacion) return '';

  try {
    const car = construirCar({
      moneda: (venta.moneda ?? 'PEN').trim().toUpperCase(),
      rucRecaudador: ruc,
      numeroOperacion: operacion,
    });
    return esCarValido(car) ? car : '';
  } catch {
    // Dato insuficiente o con formato inválido: mejor vacío que inventado.
    return '';
  }
};

/** Convierte una venta del M1 en el registro que espera la conciliación. */
export const aRegistroSire = (venta: VentaM1): RegistroParaSire => {
  const total = r2(Number(venta.total) || 0);
  const igv = r2(Number(venta.igv) || 0);

  return {
    emitterRuc: venta.rucEmisor,
    documentType: venta.tipoComprobante,
    series: venta.serie,
    correlative: correlativoSire(venta.correlativo),
    // La base no se guarda aparte: se deriva para que base + IGV = total.
    taxableBase: r2(total - igv),
    igvAmount: igv,
    totalAmount: total,
    carSunat: carDeVenta(venta),
  };
};

/**
 * Convierte un lote de ventas, descartando las que no concilian.
 *
 * El orden se conserva para que la conciliación recorra los registros en el
 * mismo orden que el usuario ve en pantalla; ordenar aquí ocultaría un cambio
 * de criterio detrás de una diferencia de presentación.
 */
export const aRegistrosSire = (ventas: readonly VentaM1[]): RegistroParaSire[] =>
  ventas.filter(conciliaEnSire).map(aRegistroSire);

/** Resumen del lote, para dejar constancia en la respuesta y en el log. */
export interface ResumenVentasM1 {
  total: number;
  incluidas: number;
  excluidas: number;
  /** Cuántas boletas quedaron sin CAR por falta de dato del recaudador. */
  sinCar: number;
}

/** Cuenta qué pasó con el lote. Coincide con `incluidas + excluidas`. */
export const resumirVentasM1 = (
  ventas: readonly VentaM1[],
): ResumenVentasM1 => {
  const incluidas = ventas.filter(conciliaEnSire);
  const sinCar = incluidas.filter(
    (venta) =>
      ['03', '07', '08'].includes(venta.tipoComprobante) &&
      carDeVenta(venta) === '',
  ).length;

  return {
    total: ventas.length,
    incluidas: incluidas.length,
    excluidas: ventas.length - incluidas.length,
    sinCar,
  };
};
