/**
 * Validación del nombre del archivo de propuesta SIRE.
 *
 * POR QUÉ ES UNA REGLA DE DOMINIO Y NO UN VALIDATOR DE DTO
 *
 * El nombre del archivo no es un dato de formulario: es la IDENTIDAD del
 * archivo frente a SUNAT. El formato oficial es
 * `LE<RUC>-<LIBRO>-<PERIODO>.zip` (por ejemplo `LE20601030013-RCE-202401.zip`).
 * Si el prefijo `LE` o el RUC no concuerdan, el archivo no corresponde a esta
 * empresa y el envío a SUNAT sería rechazado.
 *
 * Como el RUC sale del RUC de la empresa en sesión (nunca del cuerpo de la
 * petición), la comprobación no se puede expresar con un decorador de
 * `class-validator`: necesita el contexto de la empresa. Por eso vive aquí,
 * como regla pura, y la invoca el caso de uso.
 */

/** Extensiones que acepta la importación de una propuesta. */
export const SIRE_EXTENSIONES_PERMITIDAS = ['.txt', '.zip'] as const;

/** Prefijo obligatorio del archivo de propuesta. */
export const SIRE_PREFIJO_ARCHIVO = 'LE';

/** Motivos por los que un archivo puede ser rechazado. */
export type SireArchivoError =
  | 'NOMBRE_VACIO'
  | 'EXTENSION_NO_PERMITIDA'
  | 'PREFIJO_LE_INVALIDO'
  | 'RUC_NO_ENCONTRADO';

/** Resultado de validar el nombre de un archivo. */
export interface SireArchivoValidacion {
  valido: boolean;
  error?: SireArchivoError;
  mensaje?: string;
}

/**
 * Devuelve la extensión en minúsculas del archivo (con punto), o cadena
 * vacía si el nombre no tiene extensión.
 */
export function extensionDeArchivo(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf('.');
  if (punto <= 0 || punto === nombreArchivo.length - 1) {
    return '';
  }
  return nombreArchivo.slice(punto).toLowerCase();
}

/**
 * Devuelve el nombre base del archivo sin su extensión.
 */
export function nombreBaseSinExtension(nombreArchivo: string): string {
  const extension = extensionDeArchivo(nombreArchivo);
  return extension ? nombreArchivo.slice(0, -extension.length) : nombreArchivo;
}

/**
 * Normaliza un RUC para poder compararlo con el que aparece en el nombre del
 * archivo: solo dígitos.
 */
export function normalizarRuc(ruc: string): string {
  return ruc.replace(/\D/g, '');
}

/**
 * Valida que el archivo sea una propuesta SIRE de ESTA empresa.
 *
 * @param nombreArchivo Nombre original recibido en el `multipart/form-data`.
 * @param ruc RUC de la empresa de la sesión.
 */
export function validarNombreArchivoSire(
  nombreArchivo: string,
  ruc: string,
): SireArchivoValidacion {
  const nombre = (nombreArchivo ?? '').trim();

  if (!nombre) {
    return {
      valido: false,
      error: 'NOMBRE_VACIO',
      mensaje: 'El nombre del archivo no puede estar vacío.',
    };
  }

  const extension = extensionDeArchivo(nombre);
  const extensionPermitida = (
    SIRE_EXTENSIONES_PERMITIDAS as readonly string[]
  ).includes(extension);

  if (!extensionPermitida) {
    return {
      valido: false,
      error: 'EXTENSION_NO_PERMITIDA',
      mensaje: `Solo se permiten archivos ${SIRE_EXTENSIONES_PERMITIDAS.join(' o ')}.`,
    };
  }

  const base = nombreBaseSinExtension(nombre);

  if (!base.toUpperCase().startsWith(SIRE_PREFIJO_ARCHIVO)) {
    return {
      valido: false,
      error: 'PREFIJO_LE_INVALIDO',
      mensaje: `El archivo debe comenzar con "${SIRE_PREFIJO_ARCHIVO}" (formato oficial LE<RUC>-<LIBRO>-<PERIODO>).`,
    };
  }

  const rucEsperado = normalizarRuc(ruc);
  const rucEnArchivo = normalizarRuc(base);

  if (!rucEsperado || !rucEnArchivo.includes(rucEsperado)) {
    return {
      valido: false,
      error: 'RUC_NO_ENCONTRADO',
      mensaje: `El nombre del archivo debe contener el RUC ${rucEsperado || 'de la empresa'}.`,
    };
  }

  return { valido: true };
}

/** Periodo y libro deducidos del nombre del archivo. */
export interface SirePeriodoLibroDelNombre {
  periodo?: string;
  libro?: 'RVIE_VENTAS' | 'RCE_COMPRAS';
}

/**
 * Deduce el periodo y el libro del nombre del archivo.
 *
 * El nombre oficial es `LE<RUC>-<LIBRO>-<PERIODO>.zip`, por ejemplo
 * `LE20601030013-RCE-202401.zip`. Se usa como respaldo cuando el frontend no
 * envía el periodo y el libro en el cuerpo de la petición: el archivo es la
 * fuente de verdad y el cuerpo solo lo acompaña.
 */
export function extraerPeriodoYLibroDelNombre(
  nombreArchivo: string,
): SirePeriodoLibroDelNombre {
  const base = nombreBaseSinExtension((nombreArchivo ?? '').trim());
  if (!base) {
    return {};
  }

  const resultado: SirePeriodoLibroDelNombre = {};

  const periodo = extraerPeriodoValido(base);
  if (periodo) {
    resultado.periodo = periodo;
  }

  const libro = base.toUpperCase().match(/\b(RVIE|RCE)\b/);
  if (libro) {
    resultado.libro = libro[1] === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS';
  }

  return resultado;
}

/**
 * Devuelve el periodo (AAAAMM) que se deduce del nombre del archivo.
 *
 * POR QUÉ NO SE BUSCA A LO BRUTO
 *
 * El RUC son once dígitos y dentro de él hay secuencias de seis que también
 * tienen forma de periodo (`103001` es "1030-01"). Si se buscara el primer
 * grupo de seis dígitos, el periodo saldría del RUC.
 *
 * El nombre oficial separa los bloques con guiones
 * (`LE<RUC>-<LIBRO>-<PERIODO>`), así que primero se busca un token de seis
 * dígitos que sea un periodo válido. Solo si el archivo viene sin separadores
 * se recurre al RUC de once dígitos para descartar su parte.
 */
function extraerPeriodoValido(base: string): string | undefined {
  const tokens = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const tokenPeriodo = tokens.find(
    (token) => /^\d{6}$/.test(token) && esPeriodoValido(token),
  );
  if (tokenPeriodo) {
    return tokenPeriodo;
  }

  // Sin separadores: se aparta el prefijo alfabético y el RUC de once dígitos.
  const sinPrefijo = base.replace(/^[A-Za-z]+/, '');
  const resto = sinPrefijo.replace(/^\d{11}/, '');
  const ventanas = [...resto.matchAll(/(?=(\d{6}))/g)].map((coincidencia) =>
    coincidencia[1],
  );
  const validos = ventanas.filter(esPeriodoValido);
  return validos.length > 0 ? validos[validos.length - 1] : undefined;
}

/**
 * Un periodo tiene forma AAAAMM y un mes real.
 */
function esPeriodoValido(periodo: string): boolean {
  return /^(?!0000)\d{4}(0[1-9]|1[0-2])$/.test(periodo);
}
