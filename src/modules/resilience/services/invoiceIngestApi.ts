import axios from 'axios';
import { apiClient } from '@/lib/axios';
import type { InvoiceIngestPayload } from '../types/offlineQueue.types';

/** Lo que devuelve POST /api/v1/invoices cuando acepta el comprobante (202). */
export interface IngestAcceptedResponse {
  id: string;
  estado: string;
  message: string;
  created_at: string;
}

/**
 * Resultado de un intento de envio.
 *
 * Se devuelve en lugar de lanzar excepciones porque la cola necesita decidir
 * que hacer con cada caso; no hay un usuario esperando la respuesta.
 */
export type IngestOutcome =
  | { kind: 'SINCRONIZADO'; invoiceId: string }
  | { kind: 'YA_EXISTIA' }
  | { kind: 'RECHAZADO'; detail: string }
  | { kind: 'SESION_INVALIDA'; detail: string }
  | { kind: 'REINTENTABLE'; detail: string };

/**
 * Extrae el campo detail del Problem Details que genera HttpExceptionFilter.
 * Si no esta presente, usa el texto por defecto.
 */
function detailOf(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
  }
  return fallback;
}

/**
 * Envia un comprobante al endpoint de ingesta y clasifica el resultado.
 *
 * El backend responde 202 aunque SUNAT este caida: el Outbox se encarga del
 * envio real. Por eso un 202 significa "el servidor lo tiene", no "SUNAT lo
 * acepto".
 *
 * Un 409 indica que el comprobante ya existe (misma empresa, tipo, serie y
 * correlativo). Se trata como exito: reintentar no debe duplicar.
 */
export async function sendInvoice(
  payload: InvoiceIngestPayload,
): Promise<IngestOutcome> {
  try {
    const response = await apiClient.post<IngestAcceptedResponse>(
      '/invoices',
      payload,
    );

    return { kind: 'SINCRONIZADO', invoiceId: response.data.id };
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      return { kind: 'REINTENTABLE', detail: 'Error inesperado al enviar' };
    }

    // Sin response: no hubo conexion (red caida, backend apagado, CORS o timeout).
    if (!error.response) {
      return {
        kind: 'REINTENTABLE',
        detail:
          error.code === 'ECONNABORTED'
            ? 'El servidor no responde a tiempo'
            : 'Sin conexion con el servidor',
      };
    }

    const { status, data } = error.response;

    if (status === 409) {
      return { kind: 'YA_EXISTIA' };
    }

    if (status === 401 || status === 403) {
      return {
        kind: 'SESION_INVALIDA',
        detail: detailOf(data, 'La sesion no es valida'),
      };
    }

    if (status >= 400 && status < 500) {
      return {
        kind: 'RECHAZADO',
        detail: detailOf(data, 'El comprobante fue rechazado'),
      };
    }

    // 5xx: el servidor responde, pero fallo. Vale la pena reintentar.
    return {
      kind: 'REINTENTABLE',
      detail: detailOf(data, 'El servidor fallo al procesar el comprobante'),
    };
  }
}