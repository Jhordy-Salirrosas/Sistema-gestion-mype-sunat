import { listByStatus, patch } from './offlineQueue';
import { sendInvoice } from './invoiceIngestApi';
import { MAX_AUTO_ATTEMPTS } from '../types/offlineQueue.types';
import type { OfflineQueueItem } from '../types/offlineQueue.types';

/** Resumen de una pasada de sincronizacion. */
export interface SyncReport {
  enviados: number;
  duplicados: number;
  fallidos: number;
  /** Elementos que quedaron esperando porque la red seguia caida. */
  pendientes: number;
}

type SendResult = 'ENVIADO' | 'DUPLICADO' | 'FALLIDO' | 'PENDIENTE';

/** Envia un elemento y deja su estado en IndexedDB segun el resultado. */
async function sendOne(item: OfflineQueueItem): Promise<SendResult> {
  const attempts = item.attempts + 1;

  // Se marca ENVIANDO antes de la peticion: si la app muere ahora,
  // resetStuckItems lo devuelve a PENDIENTE al arrancar.
  await patch(item.id, { status: 'ENVIANDO', attempts });

  const outcome = await sendInvoice(item.payload);
  const syncedAt = new Date().toISOString();

  if (outcome.kind === 'SINCRONIZADO') {
    await patch(item.id, { status: 'SINCRONIZADO', syncedAt, lastError: undefined });
    return 'ENVIADO';
  }

  if (outcome.kind === 'YA_EXISTIA') {
    // El comprobante ya estaba en el servidor: el reintento no duplico.
    await patch(item.id, { status: 'SINCRONIZADO', syncedAt, lastError: undefined });
    return 'DUPLICADO';
  }

  if (outcome.kind === 'RECHAZADO' || outcome.kind === 'SESION_INVALIDA') {
    // Reintentar no sirve: el DTO esta mal o la sesion no es valida.
    await patch(item.id, { status: 'FALLIDO', lastError: outcome.detail });
    return 'FALLIDO';
  }

  // Reintentable: se agota el cupo automatico y pasa a FALLIDO manual.
  const agotado = attempts >= MAX_AUTO_ATTEMPTS;

  await patch(item.id, {
    status: agotado ? 'FALLIDO' : 'PENDIENTE',
    lastError: outcome.detail,
  });

  return agotado ? 'FALLIDO' : 'PENDIENTE';
}

/**
 * Sincroniza los comprobantes pendientes, uno por uno y en orden FIFO.
 *
 * Si un envio falla por causas reintentables (sin conexion, 5xx), se detiene:
 * seguir con el resto solo acumularia fallos y romperia el orden.
 */
export async function syncPending(): Promise<SyncReport> {
  const pendientes = await listByStatus('PENDIENTE');

  const report: SyncReport = {
    enviados: 0,
    duplicados: 0,
    fallidos: 0,
    pendientes: 0,
  };

  for (let i = 0; i < pendientes.length; i++) {
    const result = await sendOne(pendientes[i]);

    if (result === 'ENVIADO') {
      report.enviados++;
    } else if (result === 'DUPLICADO') {
      report.duplicados++;
    } else if (result === 'FALLIDO') {
      report.fallidos++;
    } else {
      // La red sigue caida: lo que queda espera a la proxima pasada.
      report.pendientes = pendientes.length - i;
      break;
    }
  }

  return report;
}

/**
 * Devuelve un elemento a la cola para reintentarlo manualmente.
 *
 * Reinicia attempts para que vuelva a tener el cupo automatico completo.
 * Despues hay que llamar a syncPending().
 */
export async function retryOne(id: string): Promise<void> {
  await patch(id, { status: 'PENDIENTE', attempts: 0, lastError: undefined });
}