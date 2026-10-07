/**
 * Clasificacion del codigo de respuesta del CDR al InvoiceStatus.
 *
 * Responde al criterio 4 de TA-03 ("Mapea el codigo a InvoiceStatus segun la
 * hoja CodigosRetorno"). El catalogo de descripciones vive en
 * sunat-response-codes.ts; aqui vive la REGLA.
 *
 * Los tres estados oficiales de un CDR (SUNAT, Operatividad):
 *   i)  Aceptada
 *   ii) Aceptada con observacion
 *   iii) Rechazada
 *
 * IMPORTANTE: la clasificacion depende SOLO del rango numerico, nunca del
 * texto de la descripcion. SUNAT cambia las redacciones entre versiones de sus
 * catalogos.
 */
import { InvoiceStatus } from '../../../generated/prisma/enums';

/**
 * Clasificacion detallada. InvoiceStatus solo tiene 6 valores, asi que se
 * conserva la granularidad de SUNAT aparte, para poder auditar y mostrar en el
 * Dashboard sin migrar el enum. Ver ADR-05.
 */
export type SunatCdrKind =
  | 'ACEPTADO'
  | 'ACEPTADO_CON_OBSERVACIONES'
  | 'EXCEPCION'
  | 'RECHAZADO'
  | 'OBSERVACION'
  | 'VACIO'
  | 'DESCONOCIDO';

export interface CdrClassification {
  /** Valor que se escribe en Invoice.estado. */
  status: InvoiceStatus;
  kind: SunatCdrKind;
  /** true si el comprobante SI tiene validez tributaria. */
  valido: boolean;
  /**
   * true si tiene sentido reintentar mas tarde.
   * Una EXCEPCION si (SUNAT no proceso el comprobante); un RECHAZO no: el mismo
   * XML volveria a fallar y hay que emitir un comprobante nuevo.
   */
  reintentable: boolean;
}

/**
 * Excepciones de la familia 0100-1999 que NO deben reintentarse.
 *
 * Un reintento solo tiene sentido cuando SUNAT no pudo procesar el
 * comprobante. Si el problema es la credencial, el perfil del usuario o el
 * nombre del archivo, el resultado sera identico en cada intento: reintentar
 * solo gasta el backoff y retrasa la deteccion del error.
 *
 * El codigo 0100 ("El sistema no puede responder su solicitud") queda FUERA a
 * proposito: ese si es un problema de SUNAT y si se reintenta.
 */
export const SUNAT_NON_RETRYABLE_EXCEPTION_CODES: ReadonlySet<string> = new Set(
  [
    // Seguridad y credenciales.
    '0101',
    '0102',
    '0103',
    '0104',
    '0105',
    '0106',
    '0111',
    '0112',
    '0113',
    // Formato y nombre del archivo o del ZIP (error del emisor, no de SUNAT).
    '0151',
    '0156',
    '0157',
    '0158',
    '0159',
    '0160',
    '0161',
    // XML y firma.
    '0300',
    '0301',
    '0303',
    '0304',
    '0305',
    '0306',
    // Reenvios y duplicados: el comprobante ya esta en SUNAT, hay que CONCILIAR.
    '1032',
    '1033',
    '1034',
    '1035',
    '1036',
    '1049',
  ],
);

/** Descripcion oficial del codigo, si se conoce. */
function describeSunatCode(code: string): string | null {
  const direct = SUNAT_RESPONSE_CODES[code];
  if (direct) return direct;

  // '100' y '0100' son el mismo codigo de SUNAT. El '0' NUNCA se rellena.
  if (/^\d+$/.test(code) && code.length < 4 && Number(code) !== 0) {
    return SUNAT_RESPONSE_CODES[code.padStart(4, '0')] ?? null;
  }
  return null;
}

/**
 * Codigos 98 y 99.
 *
 * OJO: 98 y 99 NO son codigos del CDR de sendBill. Son el statusCode de la
 * operacion getStatus (resumenes diarios y comunicaciones de baja, que se
 * resuelven por ticket):
 *   98 = en proceso (volver a consultar)
 *   99 = procesado con errores (el CDR ya esta disponible)
 * Se contemplan solo como defensa por si SUNAT cambia el contrato: en ese caso
 * el comprobante queda en ENVIADO (estado incierto) para conciliarlo, NUNCA en
 * RECHAZADO, porque marcar como rechazado algo que en realidad fue aceptado
 * provoca una reemision duplicada.
 */
const GET_STATUS_PENDING_CODES = new Set(['98', '99']);

export interface ResponseCodeClassification {
  status: InvoiceStatus;
  kind: SunatCdrKind;
  valido: boolean;
  reintentable: boolean;
  description: string | null;
}

export function classifyResponseCode(
  responseCode: string | number | null | undefined,
): ResponseCodeClassification {
  const raw =
    responseCode === null || responseCode === undefined
      ? ''
      : String(responseCode).trim();

  if (raw === '') {
    return {
      status: InvoiceStatus.ERROR_RED,
      kind: 'VACIO',
      valido: false,
      reintentable: true,
      description:
        'El CDR no trae codigo de respuesta: no se puede determinar el estado',
    };
  }

  // Se compara numericamente para no depender del relleno con ceros:
  // '0', '00' y '0000' son el mismo codigo aceptado.
  const value = Number.parseInt(raw, 10);
  const description = describeSunatCode(raw);

  if (Number.isNaN(value)) {
    return {
      status: InvoiceStatus.ERROR_RED,
      kind: 'DESCONOCIDO',
      valido: false,
      reintentable: true,
      description,
    };
  }

  // 0 -> ACEPTADO. Las observaciones no cambian el codigo, llegan en Note
  // (eso lo resuelve classifyCdr).
  if (value === 0) {
    return {
      status: InvoiceStatus.ACEPTADO,
      kind: 'ACEPTADO',
      valido: true,
      reintentable: false,
      description,
    };
  }

  if (GET_STATUS_PENDING_CODES.has(raw)) {
    return {
      status: InvoiceStatus.ENVIADO,
      kind: 'DESCONOCIDO',
      valido: false,
      reintentable: true,
      description:
        'El codigo 98/99 pertenece a la operacion getStatus (ticket), no al CDR de sendBill: se deja en ENVIADO para conciliar',
    };
  }

  // 0100-1999: excepcion (sistema, seguridad, archivo). El comprobante NO fue
  // informado: se corrige y se reenvia, salvo que el fallo sea determinista.
  if (value >= 100 && value <= 1999) {
    const normalized = raw.padStart(4, '0');
    return {
      status: InvoiceStatus.ERROR_RED,
      kind: 'EXCEPCION',
      valido: false,
      reintentable: !SUNAT_NON_RETRYABLE_EXCEPTION_CODES.has(normalized),
      description,
    };
  }

  // 2000-3999: rechazo. Sin validez tributaria: emitir un comprobante nuevo.
  if (value >= 2000 && value <= 3999) {
    return {
      status: InvoiceStatus.RECHAZADO,
      kind: 'RECHAZADO',
      valido: false,
      reintentable: false,
      description,
    };
  }

  // >= 4000: observacion. Por contrato no llega en ResponseCode (viaja en
  // Note junto a un codigo 0), pero si llegara, el comprobante tiene validez:
  // nunca debe marcarse como RECHAZADO.
  return {
    status: InvoiceStatus.ACEPTADO,
    kind: 'OBSERVACION',
    valido: true,
    reintentable: false,
    description,
  };
}

/**
 * Tabla de descripciones oficiales, transcrita de la hoja CodigosRetorno de
 * SUNAT (Reglas de validacion - actualizado al 26.08.2026.xlsx, 2.077 codigos)
 * y contrastada contra el CatalogoErrores.xml del facturador SFS v2.5.
 *
 * Las redacciones de SUNAT cambian entre versiones de sus catalogos, por eso
 * el mapa es DATO, no logica: se puede actualizar sin tocar el clasificador.
 */
const SUNAT_RESPONSE_CODES: Record<string, string> = {
  '0': 'El comprobante fue aceptado',

  // 01xx: sistema y seguridad (familia EXCEPCION).
  '0100':
    'El sistema no puede responder su solicitud. Intente nuevamente o comuniquese con su Administrador',
  '0101': 'El encabezado de seguridad es incorrecto',
  '0102': 'Usuario o contrasena incorrectos',
  '0103': 'El Usuario ingresado no existe',
  '0104': 'La Clave ingresada es incorrecta',
  '0105': 'El Usuario no esta activo',
  '0106': 'El Usuario no es valido',
  '0109':
    'El sistema no puede responder su solicitud. (El servicio de autenticacion no responde)',
  '0110': 'No se pudo obtener la informacion del tipo de usuario',
  '0111': 'No tiene el perfil para enviar comprobantes electronicos',
  '0112': 'El usuario debe ser secundario',
  '0113': 'El usuario no esta afiliado a Factura Electronica',

  // 015x-016x: problemas del archivo o del ZIP.
  '0151': 'El nombre del archivo ZIP es incorrecto',
  '0156': 'El archivo ZIP esta vacio',
  '0157': 'El archivo ZIP esta corrupto',
  '0158':
    'El archivo ZIP contiene demasiados comprobantes para este tipo de envio',
  '0159': 'El nombre del archivo XML es incorrecto',
  '0160': 'El XML no cumple con el formato establecido',
  '0161': 'El nombre del archivo XML no coincide con el nombre del archivo ZIP',

  // 02xx-04xx: incidencias de proceso.
  '0200': 'El comprobante fue rechazado por errores en su estructura',
  '0201': 'El comprobante ya fue informado con anterioridad',
  '0202': 'El comprobante no existe',
  '0204': 'El comprobante fue emitido en un entorno distinto al de produccion',
  '0300': 'No se encontro la raiz documento xml',
  '0301': 'El XML no contiene firmas digitales',
  '0303': 'El comprobante fue alterado despues de ser firmado',
  '0304': 'El certificado utilizado para firmar el XML esta vencido',
  '0305':
    'El XML no corresponde a un comprobante electronico o no cumple con el formato',
  '0306': 'El XML no contiene el tag de la firma digital',
  '0400': 'El comprobante fue rechazado por reglas de validacion',
  '0401': 'El comprobante ya fue informado',
  '0402':
    'La numeracion o nombre del documento ya ha sido enviado anteriormente',
  '0403': 'El comprobante fue dado de baja previamente',
  '0404': 'El comprobante fue rechazado por el OSE o PSE',

  // 1xxx: reenvios y duplicados (frecuentes despues de un timeout).
  '1032':
    'El comprobante ya esta informado y se encuentra con estado anulado o rechazado',
  '1033': 'El comprobante fue registrado previamente con otros datos',
  '1034':
    'Numero de RUC del nombre del archivo no coincide con el consignado en el contenido del archivo XML',
  '1035':
    'Numero de Serie del nombre del archivo no coincide con el consignado en el contenido del archivo XML',
  '1036':
    'Numero de documento en el nombre del archivo no coincide con el consignado en el contenido del XML',
  '1049':
    'ID - Serie y Numero del archivo no coincide con el consignado en el contenido del XML',

  // 2xxx-3xxx: rechazos (el comprobante no tiene validez).
  '2326': 'El certificado usado se encuentra de baja',
  '2335': 'El documento electronico ingresado ha sido alterado',
  '2600': 'El comprobante fue rechazado por inconsistencia en los montos',

  // 4xxx: observaciones (llegan en Note acompanando a un codigo 0).
  '4000': 'El documento ya fue presentado anteriormente',
  '4001': 'El numero de RUC del receptor no existe',
  '4002':
    'Para el TaxTypeCode, esta usando un valor que no existe en el catalogo',
  '4031': 'Debe indicar el nombre comercial',
  '4398': 'El Numero de placa no se encuentra en las bases consultadas',
  '4399':
    'No ha consignado el Numero de Constancia de Inscripcion Vehicular o Certificado de Habilitacion Vehicular o la TUC',
};
