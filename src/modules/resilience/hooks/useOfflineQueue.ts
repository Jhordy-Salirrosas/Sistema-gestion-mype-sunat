import { useCallback, useEffect, useState } from 'react';
import { enqueue, listAll } from '../services/offlineQueue';
import { resetStuckItems, summarize } from '../services/offlineQueueMaintenance';
import { retryOne } from '../services/offlineQueueSyncer';
import { sendInvoice } from '../services/invoiceIngestApi';
import { useOfflineQueueSync } from './useOfflineQueueSync';
import type {
  EmitInvoiceResult,
  InvoiceIngestPayload,
  OfflineQueueItem,
} from '../types/offlineQueue.types';

/**
 * Estado y acciones de la cola offline de comprobantes (TA-27).
 *
 * Al montar recupera los elementos que quedaron a medio enviar, carga la cola
 * y sincroniza. La mecanica de sincronizacion vive en useOfflineQueueSync.
 */
export function useOfflineQueue() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setItems(await listAll());
  }, []);

  // El candado y el listener 'online' viven en el otro hook.
  const { isSyncing, sync } = useOfflineQueueSync(refresh);

  // Arranque: recupera los ENVIANDO huerfanos, carga y sincroniza.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await resetStuckItems();
      if (cancelled) return;

      await refresh();
      if (cancelled) return;

      setIsLoading(false);
      void sync();
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh, sync]);

  /**
   * Intenta emitir un comprobante.
   *
   * Si el servidor lo acepta, no pasa por la cola. Si falla por causas
   * recuperables, se guarda en IndexedDB para que no se pierda.
   */
  const emit = useCallback(
    async (payload: InvoiceIngestPayload): Promise<EmitInvoiceResult> => {
      // Sin conexion conocida: se encola sin gastar un timeout de 15 s.
      if (!navigator.onLine) {
        await enqueue(payload);
        await refresh();
        return { enviado: false, encolado: true, detail: 'Sin conexion' };
      }

      const outcome = await sendInvoice(payload);

      if (outcome.kind === 'SINCRONIZADO') {
        return { enviado: true, encolado: false, invoiceId: outcome.invoiceId };
      }

      if (outcome.kind === 'YA_EXISTIA') {
        return { enviado: true, encolado: false };
      }

      if (outcome.kind === 'RECHAZADO' || outcome.kind === 'SESION_INVALIDA') {
        return {
          enviado: false,
          encolado: false,
          detail: outcome.detail,
          definitivo: true,
        };
      }

      await enqueue(payload);
      await refresh();

      return { enviado: false, encolado: true, detail: outcome.detail };
    },
    [refresh],
  );

  /** Reintenta manualmente un elemento fallido. */
  const retry = useCallback(
    async (id: string) => {
      await retryOne(id);
      await refresh();
      await sync();
    },
    [refresh, sync],
  );

  return {
    items,
    summary: summarize(items),
    isLoading,
    isSyncing,
    emit,
    retry,
    sync,
    refresh,
  };
}
