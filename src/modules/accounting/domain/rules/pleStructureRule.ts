import { esRucValido } from '../../../../common/validators/ruc';

/**
 * Reglas de forma de los archivos PLE (libros electrónicos).
 *
 * El PLE es un archivo de texto con campos separados por tubería (`|`), un
 * registro por línea y salto `\r\n`. Tres cosas rompen la presentación y no se
 * ven en una prueba de "el archivo se genera":
 *
 *  1. una tubería dentro de un dato (glosa, razón social) corre todas las
 *     columnas y SUNAT rechaza el archivo;
 *  2. un salto de línea dentro de un dato parte un registro en dos;
 *  3. dos comprobantes con la misma serie-correlativo en el mismo libro.
 *
 * Este módulo concentra esas comprobaciones para que exportador y validador
 * usen exactamente la misma regla.
 */

export const SEPARADOR_PLE = '|';
export const FIN_DE_LINEA = '\r\n';

/**
 * Deja un campo apto para el archivo: sin tuberías, sin saltos de línea y sin
 * espacios repetidos. No recorta el contenido más allá de eso: el PLE no
 * admite comillas ni escapes, así que la única salida segura es sustituir.
 */
export const sanearCampo = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/[|\r\n\t]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/** Construye una línea PLE terminada en tubería, como exige el formato. */
export const construirLinea = (campos: readonly unknown[]): string =>
  `${campos.map(sanearCampo).join(SEPARADOR_PLE)}${SEPARADOR_PLE}`;

/** Cantidad de columnas de una línea (ignora la tubería final). */
export const contarColumnas = (linea: string): number => {
  const partes = linea.split(SEPARADOR_PLE);
  if (partes.length > 0 && partes[partes.length - 1] === '') return partes.length - 1;
  return partes.length;
};

export interface PleStructureIssue {
  linea: number;
  message: string;
}

/**
 * Comprueba que todas las líneas tengan las mismas columnas, que ninguna quede
 * vacía y que ninguna contenga caracteres que rompan el registro.
 *
 * No fija un número mágico de columnas: el formato varía por libro y por
 * versión de la resolución, así que se valida coherencia interna. La longitud
 * esperada se puede exigir aparte con `columnasEsperadas`.
 */
export const validarEstructura = (
  lineas: readonly string[],
  columnasEsperadas?: number,
): PleStructureIssue[] => {
  const issues: PleStructureIssue[] = [];
  if (lineas.length === 0) return issues;

  const columnas = contarColumnas(lineas[0]);
  lineas.forEach((linea, indice) => {
    const numero = indice + 1;
    if (!linea.trim()) {
      issues.push({ linea: numero, message: 'La línea está vacía.' });
      return;
    }
    const actuales = contarColumnas(linea);
    if (actuales !== columnas) {
      issues.push({
        linea: numero,
        message: `La línea tiene ${actuales} columnas y la primera tiene ${columnas}.`,
      });
    }
    if (!linea.endsWith(SEPARADOR_PLE)) {
      issues.push({ linea: numero, message: 'La línea no termina en tubería.' });
    }
  });

  if (columnasEsperadas !== undefined && columnas !== columnasEsperadas) {
    issues.unshift({
      linea: 1,
      message: `El libro tiene ${columnas} columnas y se esperaban ${columnasEsperadas}.`,
    });
  }
  return issues;
};

/** Valida el RUC del emisor con el dígito verificador, no solo con la longitud. */
export const validarRucEmisor = (ruc: string): string | null => {
  if (!esRucValido(ruc)) {
    return 'El RUC del emisor no supera la validación módulo 11 (dígito verificador).';
  }
  return null;
};

/** Claves repetidas dentro del mismo libro (serie-correlativo, asiento, etc.). */
export const clavesDuplicadas = (claves: readonly string[]): string[] => {
  const vistas = new Set<string>();
  const repetidas = new Set<string>();
  for (const clave of claves) {
    if (vistas.has(clave)) repetidas.add(clave);
    vistas.add(clave);
  }
  return [...repetidas];
};

/** Redondea a céntimos sin arrastrar error de coma flotante. */
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
