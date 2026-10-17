/**
 * Clasificación del código de respuesta del CDR al InvoiceStatus.
 * Responde al criterio 4 de TA-03 ("Mapea el código a InvoiceStatus según la hoja CódigosRetorno").
 */
import { InvoiceStatus } from '../../../generated/client/enums';
import {
  SUNAT_NON_RETRYABLE_EXCEPTION_CODES,
  describeSunatCode,
} from './sunatResponseCodes';

export { SUNAT_NON_RETRYABLE_EXCEPTION_CODES } from './sunatResponseCodes';

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
  /** true si tiene sentido reintentar más tarde. */
  reintentable: boolean;
}

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

  // 0100-1999: excepción
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

  // 2000-3999: rechazo
  if (value >= 2000 && value <= 3999) {
    return {
      status: InvoiceStatus.RECHAZADO,
      kind: 'RECHAZADO',
      valido: false,
      reintentable: false,
      description,
    };
  }

  // >= 4000: observación
  return {
    status: InvoiceStatus.ACEPTADO,
    kind: 'OBSERVACION',
    valido: true,
    reintentable: false,
    description,
  };
}
