import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { OfflineQueueRow } from './OfflineQueueRow';
import type {
  OfflineQueueItem,
  OfflineQueueSummary,
} from '../types/offlineQueue.types';

interface OfflineQueuePanelProps {
  items: OfflineQueueItem[];
  summary: OfflineQueueSummary;
  isLoading: boolean;
  isSyncing: boolean;
  onRetry: (id: string) => void;
}

/** Las cuatro tarjetas de estado que pide el criterio 4. */
const TARJETAS = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'enviando', label: 'En envio' },
  { key: 'sincronizados', label: 'Sincronizados' },
  { key: 'fallidos', label: 'Fallidos' },
] as const;

const COLUMNAS = 7;

/** Panel de estado de la cola: contadores y detalle por comprobante. */
export function OfflineQueuePanel({
  items,
  summary,
  isLoading,
  isSyncing,
  onRetry,
}: OfflineQueuePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TARJETAS.map((tarjeta) => (
          <Card key={tarjeta.key} size="sm">
            <CardContent className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {tarjeta.label}
              </span>
              <span className="font-heading text-2xl font-semibold">
                {summary[tarjeta.key]}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead align="right">Monto</TableHead>
              <TableHead align="center">Estado</TableHead>
              <TableHead align="center">Intentos</TableHead>
              <TableHead>Ultimo error</TableHead>
              <TableHead align="center">Encolado</TableHead>
              <TableHead align="center">Accion</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} align="center">
                  Cargando cola local...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} align="center">
                  La cola esta vacia: no hay comprobantes pendientes de envio.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <OfflineQueueRow
                  key={item.id}
                  item={item}
                  onRetry={onRetry}
                  disabled={isSyncing}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}