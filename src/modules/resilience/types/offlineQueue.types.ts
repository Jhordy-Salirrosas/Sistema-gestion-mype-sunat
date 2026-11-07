/**
 * Tipos de la cola offline de comprobantes (TA-27).
 *
 * La cola vive en IndexedDB del navegador: sobrevive recargas y cierres, y
 * sincroniza sola cuando el backend vuelve a estar disponible.
 *
 * El payload replica EXACTAMENTE el contrato de POST /api/v1/invoices del
 * backend. No se usa el CreateInvoiceDto de src/modules/invoices/types porque
 * ese modelo esta pensado para la interfaz (items, moneda) y el backend valida
 * con forbidNonWhitelisted: cualquier campo extra devuelve 400.
 */

/** Cuerpo aceptado por POST /api/v1/invoices. */
export interface InvoiceIngestPayload {
  ruc_emisor: string;
  /** Serie autorizada: 1 letra + 3 digitos (ej. F001). */
  serie: string;
  correlativo: number;
  /** Codigo SUNAT de 2 digitos: 01 factura, 03 boleta. */
  tipo_comprobante: string;
  monto_total: number;
  /** Fecha en formato ISO 8601 (ej. 2026-10-17T10:30:00.000Z). */
  fecha_emision: string;
  payload_ubl: Record<string, unknown>;
}

/**
 * Ciclo de vida de un elemento de la cola.
 *
 * PENDIENTE    Guardado, esperando que vuelva la conexion.
 * ENVIANDO     Peticion en curso. Si la app se cierra en este estado, al
 *              arrancar se revierte a PENDIENTE (ver resetStuckItems).
 * SINCRONIZADO Enviado y aceptado por el backend, o ya existia (409).
 * FALLIDO      Error no recuperable, o se agotaron los reintentos.
 *              Solo se reintenta manualmente desde el panel.
 */
export type QueueItemStatus =
  | 'PENDIENTE'
  | 'ENVIANDO'
  | 'SINCRONIZADO'
  | 'FALLIDO';

/** Un comprobante guardado en la cola local. */
export interface OfflineQueueItem {
  /** Clave primaria: UUID generado al encolar. */
  id: string;
  payload: InvoiceIngestPayload;
  status: QueueItemStatus;
  /** Cantidad de intentos de envio realizados. */
  attempts: number;
  /** Mensaje del ultimo fallo, para mostrarlo en el panel. */
  lastError?: string;
  /** ISO 8601. Define el orden de sincronizacion (FIFO). */
  createdAt: string;
  updatedAt: string;
  /** ISO 8601, solo cuando status es SINCRONIZADO. */
  syncedAt?: string;
}

/** Contadores por estado, para las tarjetas del panel. */
export interface OfflineQueueSummary {
  pendientes: number;
  enviando: number;
  sincronizados: number;
  fallidos: number;
}

/** Nombre de la base de datos en IndexedDB. */
export const OFFLINE_DB_NAME = 'sync-sunat-offline';

/** Version del esquema. Se incrementa al cambiar el store o sus indices. */
export const OFFLINE_DB_VERSION = 1;

/** Object store donde viven los comprobantes. */
export const OFFLINE_STORE = 'invoice-queue';

/** Reintentos automaticos antes de marcar un elemento como FALLIDO. */
export const MAX_AUTO_ATTEMPTS = 3;

/** Espera entre reintentos automaticos, en milisegundos. */
export const RETRY_DELAY_MS = 2000;

/** Resultado de intentar emitir un comprobante desde la interfaz. */
export interface EmitInvoiceResult {
  /** El servidor lo acepto en el acto. */
  enviado: boolean;
  /** Quedo guardado en la cola local para reintentar despues. */
  encolado: boolean;
  invoiceId?: string;
  detail?: string;
  /** El rechazo es definitivo: reintentar no sirve. */
  definitivo?: boolean;
}