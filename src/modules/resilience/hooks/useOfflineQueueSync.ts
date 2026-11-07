import { useCallback, useEffect, useRef, useState } from 'react';
import { syncPending, type SyncReport } from '../services/offlineQueueSyncer';

/**
 * Mecanica de sincronizacion de la cola offline.
 *
 * Encapsula el candado que evita pasadas solapadas y el listener del evento
 * online. Se separa de useOfflineQueue para respetar el limite de 120 lineas
 * por archivo que exige specs/modulosSpecs/resilience.spec.md.
 *
 * @param onAfterSync Se invoca al terminar cada pasada, para recargar la lista.
 */
export function useOfflineQueueSync(
  onAfterSync: () => Promise<void>,
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  /**
   * Una pasada de sincronizacion.
   *
   * Devuelve null si ya habia una en curso: dos pasadas simultaneas enviarian
   * el mismo comprobante dos veces.
   */
  const sync = useCallback(async (): Promise<SyncReport | null> => {
    if (syncingRef.current) {
      return null;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const report = await syncPending();
      await onAfterSync();
      return report;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [onAfterSync]);

  // Criterio 3: al volver la conexion, sincroniza sola.
  useEffect(() => {
    const onOnline = () => {
      void sync();
    };

    window.addEventListener('online', onOnline);

    return () => window.removeEventListener('online', onOnline);
  }, [sync]);

  return { isSyncing, sync };
}