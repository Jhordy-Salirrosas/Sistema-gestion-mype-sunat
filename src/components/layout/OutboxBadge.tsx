import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { Badge } from '@/components/ui';
import { flushOutbox, listPendingOperations } from '@/lib/outbox';

export function OutboxBadge() {
  const [pendientes, setPendientes] = useState(0);
  const [conflictos, setConflictos] = useState(0);

  const refrescar = () => {
    void listPendingOperations()
      .then((ops) => {
        setPendientes(ops.length);
        setConflictos(ops.filter((op) => op.status === 'FAILED').length);
      })
      .catch(() => {
        setPendientes(0);
        setConflictos(0);
      });
  };

  useEffect(() => {
    refrescar();
    window.addEventListener('outbox:changed', refrescar);
    window.addEventListener('online', refrescar);
    return () => {
      window.removeEventListener('outbox:changed', refrescar);
      window.removeEventListener('online', refrescar);
    };
  }, []);

  if (pendientes === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flushOutbox(true).then(refrescar)}
      title="Reintentar operaciones pendientes"
      className="inline-flex"
    >
      <Badge variant={conflictos > 0 ? 'destructive' : 'outline'} className="gap-1 text-[10px]">
        <CloudUpload className="h-3 w-3" />
        {pendientes} pendiente(s){conflictos > 0 ? ` · ${conflictos} conflicto(s)` : ''}
      </Badge>
    </button>
  );
}
