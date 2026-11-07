import { Badge, Button, TableCell, TableRow } from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import { MAX_AUTO_ATTEMPTS } from '../types/offlineQueue.types';
import type {
  OfflineQueueItem,
  QueueItemStatus,
} from '../types/offlineQueue.types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Etiqueta y color normativo de cada estado de la cola. */
const STATUS_META: Record<QueueItemStatus, { label: string; variant: BadgeVariant }> = {
  PENDIENTE: { label: 'Pendiente', variant: 'outline' },
  ENVIANDO: { label: 'Enviando', variant: 'secondary' },
  SINCRONIZADO: { label: 'Sincronizado', variant: 'default' },
  FALLIDO: { label: 'Fallido', variant: 'destructive' },
};

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface OfflineQueueRowProps {
  item: OfflineQueueItem;
  onRetry: (id: string) => void;
  disabled: boolean;
}

/** Una fila del panel: comprobante, estado, intentos y accion de reintento. */
export function OfflineQueueRow({
  item,
  onRetry,
  disabled,
}: OfflineQueueRowProps) {
  const meta = STATUS_META[item.status];
  const comprobante = `${item.payload.serie}-${item.payload.correlativo}`;
  const puedeReintentar =
    item.status === 'FALLIDO' || item.status === 'PENDIENTE';

  return (
    <TableRow>
      <TableCell className="font-medium">{comprobante}</TableCell>

      <TableCell align="right">{item.payload.monto_total.toFixed(2)}</TableCell>

      <TableCell align="center">
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </TableCell>

      <TableCell align="center">
        {item.attempts}/{MAX_AUTO_ATTEMPTS}
      </TableCell>

      <TableCell className="max-w-56 truncate" title={item.lastError}>
        {item.lastError ?? '—'}
      </TableCell>

      <TableCell align="center">{formatHora(item.createdAt)}</TableCell>

      <TableCell align="center">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !puedeReintentar}
          onClick={() => onRetry(item.id)}
        >
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      </TableCell>
    </TableRow>
  );
}