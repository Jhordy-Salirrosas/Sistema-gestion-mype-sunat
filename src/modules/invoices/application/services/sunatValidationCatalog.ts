/**
 * Catálogo de reglas de validación de SUNAT (TA-31).
 *
 * Cada entrada traduce un código de error de la hoja oficial a un mensaje
 * legible y a la acción que debe tomar el pipeline. El criterio 3 del backlog
 * pide justamente eso: "los códigos devueltos se traducen a mensajes
 * legibles".
 *
 * Se mantiene como dato puro (sin I/O ni dependencias) para que sea
 * verificable en pruebas y para que el equipo pueda ampliarlo sin tocar el
 * validador.
 */

/** Qué debe hacer el pipeline cuando aparece esta regla. */
export type AccionRegla =
  /** El comprobante está mal emitido: corregirlo es trabajo del usuario. */
  | 'CORREGIR_DATOS'
  /** Falta un dato obligatorio del emisor, cliente o certificado. */
  | 'COMPLETAR_DATOS'
  /** El formato del comprobante no cumple el estándar. */
  | 'CORREGIR_FORMATO';

export interface ReglaSunat {
  /** Código de 4 dígitos tal como lo reporta la hoja oficial. */
  codigo: string;
  /** Mensaje legible, en español. */
  mensaje: string;
  /** Acción recomendada. */
  accion: AccionRegla;
}

/**
 * Reglas del catálogo.
 *
 * Los códigos corresponden a los rangos 2xxx (rechazo de estructura) y 4xxx
 * (observación) del catálogo oficial de SUNAT, que es el mismo que usa
 * `sunatResponseCodes.ts` para los CDR. Aquí se listan los que la hoja XSL
 * de comprobantes 2.0.1 reporta con más frecuencia.
 */
export const CATALOGO_REGLAS_SUNAT: readonly ReglaSunat[] = [
  {
    codigo: '1033',
    mensaje:
      'La serie no corresponde al tipo de comprobante: una factura usa F/E y una nota usa FC/FD',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2022',
    mensaje:
      'El RUC del adquirente coincide con el del emisor: un comprobante no puede emitirse a sí mismo',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2100',
    mensaje:
      'El importe total no coincide con la suma de los ítems: revise el cálculo de IGV',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2110',
    mensaje:
      'El total de IGV no corresponde a la tasa vigente sobre la base imponible',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2150',
    mensaje:
      'La fecha de emisión es anterior o posterior al periodo permitido por SUNAT',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2200',
    mensaje:
      'El nombre o razón social del adquirente no está consignado',
    accion: 'COMPLETAR_DATOS',
  },
  {
    codigo: '2210',
    mensaje:
      'El número de documento del adquirente no es válido para el tipo de documento indicado',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2335',
    mensaje:
      'El documento fue alterado después de ser firmado: vuelva a firmarlo',
    accion: 'CORREGIR_FORMATO',
  },
  {
    codigo: '2500',
    mensaje:
      'El comprobante no referencia la factura que modifica (notas de crédito y débito)',
    accion: 'COMPLETAR_DATOS',
  },
  {
    codigo: '2600',
    mensaje:
      'Inconsistencia en los montos: la base imponible, el IGV y el total no cuadran',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '2800',
    mensaje:
      'El monto total es cero o negativo: el comprobante no tiene valor tributario',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '3001',
    mensaje:
      'Falta el certificado digital del emisor o su número de documento en el XML',
    accion: 'COMPLETAR_DATOS',
  },
  {
    codigo: '3244',
    mensaje:
      'La moneda del comprobante no está en el catálogo 02 de SUNAT',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '3300',
    mensaje:
      'El tipo de afectación del IGV del ítem no pertenece al catálogo 07',
    accion: 'CORREGIR_DATOS',
  },
  {
    codigo: '4072',
    mensaje:
      'El monto total declarado difiere del cálculo con la tasa de IGV aplicada al ítem',
    accion: 'CORREGIR_DATOS',
  },
] as const;

/** Índice por código para búsquedas O(1). */
const POR_CODIGO = new Map<string, ReglaSunat>(
  CATALOGO_REGLAS_SUNAT.map((regla) => [regla.codigo, regla]),
);

/** Devuelve la regla del código, o `null` si no está en el catálogo. */
export function reglaPorCodigo(codigo: string): ReglaSunat | null {
  return POR_CODIGO.get(codigo) ?? null;
}

/**
 * Mensaje legible para un código, con respaldo si no está en el catálogo.
 *
 * Nunca devuelve `null`: un comprobante bloqueado siempre debe poder explicar
 * por qué, y "código 2955 no documentado" ya es una explicación útil.
 */
export function mensajeLegible(codigo: string): string {
  return (
    reglaPorCodigo(codigo)?.mensaje ??
    `El XML no cumple la regla ${codigo} de SUNAT (fuera del catálogo local)`
  );
}
