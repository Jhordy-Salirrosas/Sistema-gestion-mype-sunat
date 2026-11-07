import { useState, type FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { OfflineEmitFields, type EmitFormValues } from './OfflineEmitFields';
import type {
  EmitInvoiceResult,
  InvoiceIngestPayload,
} from '../types/offlineQueue.types';

interface OfflineEmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmit: (payload: InvoiceIngestPayload) => Promise<EmitInvoiceResult>;
}

const INICIAL: EmitFormValues = {
  ruc_emisor: '20123456786',
  serie: 'F001',
  correlativo: '1',
  monto_total: '118.00',
};

/** Arma el payload con el contrato del backend. */
function buildPayload(values: EmitFormValues): InvoiceIngestPayload {
  return {
    ruc_emisor: values.ruc_emisor.trim(),
    serie: values.serie.trim().toUpperCase(),
    correlativo: Number(values.correlativo),
    tipo_comprobante: '01',
    monto_total: Number(values.monto_total),
    fecha_emision: new Date().toISOString(),
    payload_ubl: { origen: 'cola-offline', demo: true },
  };
}

/** Punto de emision de prueba: arma el payload y lo entrega a la cola. */
export function OfflineEmitDialog({
  open,
  onOpenChange,
  onEmit,
}: OfflineEmitDialogProps) {
  const [values, setValues] = useState<EmitFormValues>(INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function handleChange(field: keyof EmitFormValues, value: string) {
    setValues((previos) => ({ ...previos, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setMensaje(null);

    const payload = buildPayload(values);
    const resultado = await onEmit(payload);
    setEnviando(false);

    const referencia = `${payload.serie}-${payload.correlativo}`;

    if (resultado.enviado) {
      setMensaje(`${referencia} enviado al servidor.`);
      handleChange('correlativo', String(payload.correlativo + 1));
      return;
    }

    if (resultado.encolado) {
      setMensaje(`${referencia} guardado en la cola local.`);
      handleChange('correlativo', String(payload.correlativo + 1));
      return;
    }

    setMensaje(`Rechazado: ${resultado.detail ?? 'error desconocido'}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emitir comprobante</DialogTitle>
          <DialogDescription>
            Punto de emision de prueba de la cola offline (TA-27).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <OfflineEmitFields values={values} onChange={handleChange} />

          {mensaje ? (
            <p className="text-xs text-muted-foreground">{mensaje}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Emitiendo...' : 'Emitir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}