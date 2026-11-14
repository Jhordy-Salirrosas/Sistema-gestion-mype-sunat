/**
 * Generación de los datos simulados de la conciliación y del resumen.
 *
 * POR QUÉ ES DETERMINISTA
 *
 * La conciliación de este módulo es una SIMULACIÓN: todavía no se cruza contra
 * SUNAT. Aun así, el resultado se persiste en `sire_conciliaciones` y el
 * frontend lo vuelve a pedir varias veces. Si los números cambiasen en cada
 * llamada, el usuario vería un resumen que no cuadra con el que acaba de
 * revisar.
 *
 * Por eso todo se deriva de una SEMILLA (`periodo|libro|índice`): los mismos
 * datos de entrada producen siempre la misma salida. No es aleatoriedad: es
 * una función pura.
 *
 * Es una regla de dominio pura: no conoce Nest, ni Prisma, ni PgBoss.
 */

/** Libros que admite el menú SIRE. */
export type SireLibroSimulado = 'RVIE' | 'RCE';

/** Estado del cruce de un comprobante. */
export type SireEstadoSimulado = 'CONCILIADO' | 'DIFERENCIA';

/** Comprobante simulado que devuelve la conciliación. */
export interface SireComprobanteSimulado {
  tipo: string;
  tipoDescripcion: string;
  serie: string;
  correlativo: number;
  rucEmisor: string;
  fechaEmision: string;
  baseImponible: number;
  igv: number;
  total: number;
  estado: SireEstadoSimulado;
  diferencia: number;
}

/** Resumen simulado de un periodo. */
export interface SireResumenSimulado {
  periodo: string;
  libro: SireLibroSimulado;
  totalComprobantes: number;
  conciliados: number;
  diferencias: number;
  baseImponible: number;
  igv: number;
  total: number;
  importeConciliado: number;
  importeConDiferencia: number;
  porcentajeConciliado: number;
}

/** Mínimo de comprobantes simulados cuando el periodo no tiene importaciones. */
export const SIRE_MINIMO_COMPROBANTES_SIMULADOS = 5;

/** Máximo de comprobantes simulados que se devuelven en una respuesta. */
export const SIRE_MAXIMO_COMPROBANTES_SIMULADOS = 200;

/** Tasa de IGV vigente (%). */
const IGV = 0.18;

/** Porcentaje de comprobantes que se consideran conciliados. */
const TASA_CONCILIACION = 0.85;

const TIPOS_COMPROBANTE: Array<{ codigo: string; descripcion: string }> = [
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '01', descripcion: 'Factura' },
  { codigo: '03', descripcion: 'Boleta de venta' },
  { codigo: '02', descripcion: 'Nota de crédito' },
];

/**
 * Hash FNV-1a de 32 bits.
 *
 * Sirve para convertir una cadena en una semilla numérica estable. No es un
 * hash criptográfico: solo tiene que ser reproducible y repartido.
 */
function hashSemilla(semilla: string): number {
  let hash = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    hash ^= semilla.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Número pseudoaleatorio determinista en `[0, 1)` para la semilla dada.
 */
function valorDeterminista(semilla: string): number {
  return hashSemilla(semilla) / 0x100000000;
}

/**
 * Redondea a dos decimales evitando el error binario de coma flotante.
 */
function redondearDosDecimales(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula cuántos comprobantes se simulan a partir del número de
 * importaciones del periodo.
 *
 * Cada importación aporta cuatro comprobantes simulados. Si el periodo aún no
 * tiene importaciones se devuelve un mínimo para que la pantalla de
 * conciliación no quede vacía.
 */
export function cantidadComprobantesSimulados(
  cantidadImportaciones: number,
): number {
  const base = Math.max(
    SIRE_MINIMO_COMPROBANTES_SIMULADOS,
    cantidadImportaciones * 4,
  );
  return Math.min(base, SIRE_MAXIMO_COMPROBANTES_SIMULADOS);
}

/**
 * Genera el último día del periodo (AAAAMM) como fecha ISO.
 */
function ultimoDiaDelPeriodo(periodo: string): Date {
  const anio = Number(periodo.slice(0, 4));
  const mes = Number(periodo.slice(4, 6));
  // El día 0 del mes siguiente es el último día del mes pedido.
  return new Date(Date.UTC(anio, mes, 0));
}

/**
 * Genera la lista mockeada de comprobantes de un periodo.
 *
 * @param periodo Periodo en formato AAAAMM.
 * @param libro Libro conciliado.
 * @param cantidadImportaciones Importaciones registradas en el periodo.
 */
export function generarComprobantesSimulados(
  periodo: string,
  libro: SireLibroSimulado,
  cantidadImportaciones: number,
): SireComprobanteSimulado[] {
  const total = cantidadComprobantesSimulados(cantidadImportaciones);
  const ultimoDia = ultimoDiaDelPeriodo(periodo);
  const comprobantes: SireComprobanteSimulado[] = [];

  for (let indice = 0; indice < total; indice += 1) {
    const semilla = `${periodo}|${libro}|${indice}`;
    const tipo = TIPOS_COMPROBANTE[
      Math.floor(valorDeterminista(`${semilla}|tipo`) * TIPOS_COMPROBANTE.length)
    ];

    const baseImponible = redondearDosDecimales(
      50 + valorDeterminista(`${semilla}|base`) * 4950,
    );
    const igv = redondearDosDecimales(baseImponible * IGV);
    const totalComprobante = redondearDosDecimales(baseImponible + igv);

    const conciliado = valorDeterminista(`${semilla}|estado`) < TASA_CONCILIACION;
    const diferencia = conciliado
      ? 0
      : redondearDosDecimales(1 + valorDeterminista(`${semilla}|dif`) * 49);

    // El día del periodo se reparte de forma determinista.
    const dia = 1 + Math.floor(valorDeterminista(`${semilla}|dia`) * ultimoDia.getUTCDate());
    const fecha = new Date(
      Date.UTC(ultimoDia.getUTCFullYear(), ultimoDia.getUTCMonth(), dia),
    );

    const prefijoSerie = tipo.codigo === '03' ? 'B001' : tipo.codigo === '02' ? 'FC01' : 'F001';

    comprobantes.push({
      tipo: tipo.codigo,
      tipoDescripcion: tipo.descripcion,
      serie: prefijoSerie,
      correlativo: indice + 1,
      rucEmisor: String(10000000000 + Math.floor(valorDeterminista(`${semilla}|ruc`) * 999999999)),
      fechaEmision: fecha.toISOString().slice(0, 10),
      baseImponible,
      igv,
      total: totalComprobante,
      estado: conciliado ? 'CONCILIADO' : 'DIFERENCIA',
      diferencia,
    });
  }

  return comprobantes;
}

/**
 * Calcula el resumen simulado a partir de la lista de comprobantes.
 */
export function calcularResumenSimulado(
  periodo: string,
  libro: SireLibroSimulado,
  comprobantes: SireComprobanteSimulado[],
): SireResumenSimulado {
  const conciliados = comprobantes.filter(
    (comprobante) => comprobante.estado === 'CONCILIADO',
  );
  const diferencias = comprobantes.length - conciliados.length;

  const suma = (lista: SireComprobanteSimulado[], clave: 'baseImponible' | 'igv' | 'total') =>
    redondearDosDecimales(lista.reduce((acumulado, item) => acumulado + item[clave], 0));

  const total = comprobantes.length;

  return {
    periodo,
    libro,
    totalComprobantes: total,
    conciliados: conciliados.length,
    diferencias,
    baseImponible: suma(comprobantes, 'baseImponible'),
    igv: suma(comprobantes, 'igv'),
    total: suma(comprobantes, 'total'),
    importeConciliado: suma(conciliados, 'total'),
    importeConDiferencia: suma(
      comprobantes.filter((comprobante) => comprobante.estado === 'DIFERENCIA'),
      'total',
    ),
    porcentajeConciliado:
      total === 0 ? 0 : redondearDosDecimales((conciliados.length / total) * 100),
  };
}
