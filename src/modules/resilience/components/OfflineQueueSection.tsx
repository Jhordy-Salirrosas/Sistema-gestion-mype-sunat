import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { FilePlus, RefreshCw } from 'lucide-react';
import { OfflineEmitDialog } from './OfflineEmitDialog';
import { OfflineQueuePanel } from './OfflineQueuePanel';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

/**
 * Seccion de la cola offline dentro del dashboard de resiliencia (TA-27).
 *
 * Es el unico lugar donde se invoca useOfflineQueue: el panel y el dialogo son
 * presentacionales y reciben el estado por props.
 */
export function OfflineQueueSection() {
  const { items, summary, isLoading, isSyncing, emit, retry, sync } =
    useOfflineQueue();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PageText variant="label">Cola offline de comprobantes</PageText>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void sync()}
            disabled={isSyncing}
          >
            <RefreshCw aria-hidden="true" />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>

          <Button size="sm" onClick={() => setDialogoAbierto(true)}>
            <FilePlus aria-hidden="true" />
            Emitir de prueba
          </Button>
        </div>
      </div>

      <PageText variant="caption">
        Comprobantes guardados en este navegador mientras SUNAT o la conexion no
        estan disponibles. Sincronizan solos al recuperar la conexion.
      </PageText>

      <OfflineQueuePanel
        items={items}
        summary={summary}
        isLoading={isLoading}
        isSyncing={isSyncing}
        onRetry={(id) => void retry(id)}
      />

      <OfflineEmitDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        onEmit={emit}
      />
    </section>
  );
}