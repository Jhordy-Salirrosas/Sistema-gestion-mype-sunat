import { listByStatus, patch, remove } from './offlineQueue';
import type {
  OfflineQueueItem,
  OfflineQueueSummary,
} from '../types/offlineQueue.types';

/**
 * Operaciones de mantenimiento de la cola offline.
 *
 * Se separan del CRUD para respetar el limite de 120 lineas por archivo que
 * exige specs/modulosSpecs/resilience.spec.md.
 */

/**
 * Revierte a PENDIENTE los elementos que quedaron en ENVIANDO.
 *
 * Si la aplicacion se cierra o se recarga mientras una peticion esta en vuelo,
 * el elemento queda en ENVIANDO para siempre y nunca se reintentaria. Se llama
 * al arrancar la aplicacion.
 *
 * Devuelve cuantos elementos se recuperaron.
 */
export async function resetStuckItems(): Promise<number> {
  const stuck = await listByStatus('ENVIANDO');

  await Promise.all(
    stuck.map((item) => patch(item.id, { status: 'PENDIENTE' })),
  );

  return stuck.length;
}

/** Borra de la base los elementos ya sincronizados. */
export async function clearSynced(): Promise<void> {
  const synced = await listByStatus('SINCRONIZADO');

  await Promise.all(synced.map((item) => remove(item.id)));
}

/** Cuenta los elementos por estado, para las tarjetas del panel. */
export function summarize(items: OfflineQueueItem[]): OfflineQueueSummary {
  return {
    pendientes: items.filter((i) => i.status === 'PENDIENTE').length,
    enviando: items.filter((i) => i.status === 'ENVIANDO').length,
    sincronizados: items.filter((i) => i.status === 'SINCRONIZADO').length,
    fallidos: items.filter((i) => i.status === 'FALLIDO').length,
  };
}