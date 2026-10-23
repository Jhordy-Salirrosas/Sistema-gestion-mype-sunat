/**
 * Reglas oficiales de series por tipo de comprobante (M1).
 *
 * SUNAT determina el tipo de comprobante a partir del primer carácter de la
 * serie, por lo que una serie de Nota de Crédito (FC01) nunca puede viajar en
 * un comprobante tipo 01. Este módulo centraliza ese mapeo para que el
 * decorador de DTO y el value object compartan la misma tabla.
 */
import { CATALOGO_01_TIPO_COMPROBANTE } from '../../sunatCatalogs';

interface ReglaSerie {
  /** Expresión que debe cumplir la serie completa. */
  patron: RegExp;
  /** Explicación mostrada al usuario cuando la serie no cumple. */
  mensaje: string;
}

/**
 * Series admitidas por tipo del Catálogo 01.
 * - Facturas (01): F### por sistema propio, E### por el Portal SUNAT.
 * - Boletas (03): B### por sistema propio, EB## por el Portal SUNAT.
 * - Notas de crédito (07): FC## (sobre factura) o BC## (sobre boleta).
 * - Notas de débito (08): FD## (sobre factura) o BD## (sobre boleta).
 *
 * Las series de nota (FC01, FD01) también tendrían la forma F###, por lo que
 * los patrones excluyen explícitamente esos prefijos: una serie de Nota de
 * Crédito jamás puede viajar en un comprobante tipo 01.
 */
export const REGLAS_SERIE: Record<string, ReglaSerie> = {
  '01': {
    patron: /^(?:F|E)(?![CD])(?:[A-Z0-9]{3})$/,
    mensaje:
      'Para Facturas (01), la serie debe comenzar con F (sistemas propios) o E (Portal SUNAT) y tener 4 caracteres',
  },
  '03': {
    patron: /^(?:B[A-Z0-9]{3}|EB[A-Z0-9]{2})$/,
    mensaje:
      'Para Boletas (03), la serie debe comenzar con B (sistemas propios) o EB (Portal SUNAT) y tener 4 caracteres',
  },
  '07': {
    patron: /^(?:FC|BC)[A-Z0-9]{2}$/,
    mensaje:
      'Para Notas de Crédito (07), la serie debe comenzar con FC (sobre factura) o BC (sobre boleta) y tener 4 caracteres',
  },
  '08': {
    patron: /^(?:FD|BD)[A-Z0-9]{2}$/,
    mensaje:
      'Para Notas de Débito (08), la serie debe comenzar con FD (sobre factura) o BD (sobre boleta) y tener 4 caracteres',
  },
};

/** Mensaje genérico cuando el tipo o la serie no son reconocidos. */
export const MENSAJE_SERIE_INVALIDA =
  'La serie ingresada no corresponde con el tipo de comprobante especificado (o el tipo es inválido)';

/**
 * Valida la serie contra el tipo del Catálogo 01.
 *
 * La comparación es estricta: no se normalizan mayúsculas ni se recortan
 * espacios, porque SUNAT rechaza las series en minúscula y el DTO debe
 * devolver el error al usuario en lugar de corregirlo en silencio.
 */
export const serieCorrespondeATipo = (serie: string, tipo: string): boolean => {
  if (typeof serie !== 'string' || typeof tipo !== 'string') return false;

  const regla = REGLAS_SERIE[tipo.trim()];
  if (!regla) return false;

  return regla.patron.test(serie);
};

/** Serie mínima que SUNAT exige para un tipo (para mensajes de ayuda). */
export const serieSugerida = (tipo: string): string => {
  switch (tipo) {
    case '01':
      return 'F001';
    case '03':
      return 'B001';
    case '07':
      return 'FC01';
    case '08':
      return 'FD01';
    default:
      return '';
  }
};

/** Indica si el tipo de comprobante existe en el Catálogo 01. */
export const tipoComprobanteExiste = (tipo: string): boolean =>
  Object.prototype.hasOwnProperty.call(CATALOGO_01_TIPO_COMPROBANTE, tipo);
