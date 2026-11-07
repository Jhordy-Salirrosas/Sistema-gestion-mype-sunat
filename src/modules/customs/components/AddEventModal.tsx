import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AddEventPayload, type CustomsEventType } from '../types';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AddEventPayload) => Promise<unknown>;
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [eventType, setEventType] = useState<CustomsEventType>('LLEGADA_MEDIO_TRANSPORTE');
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [eventValue, setEventValue] = useState('');
  const [refCode, setRefCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        event_type: eventType,
        event_timestamp: new Date(timestamp).toISOString(),
        event_value: eventValue || undefined,
        reference_code: refCode || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Registrar Hito Aduanero Oficial</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-medium text-foreground block mb-1">Tipo de Evento</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CustomsEventType)}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
            >
              <option value="EMBARQUE">Zarpe / Embarque en Origen</option>
              <option value="LLEGADA_MEDIO_TRANSPORTE">Llegada del Medio de Transporte</option>
              <option value="TERMINO_DESCARGA">Término de la Descarga</option>
              <option value="NUMERACION_DAM">Numeración Oficial de la DAM</option>
              <option value="CANAL_ASIGNADO">Asignación de Canal (Verde/Naranja/Rojo)</option>
              <option value="DILIGENCIA_CONFORME">Diligencia Conforme de Especialista</option>
              <option value="PAGO_TRIBUTOS">Cancelación de Deuda Tributaria</option>
              <option value="LEVANTE">Levante Autorizado SUNAT</option>
              <option value="RETIRO_MERCANCIA">Retiro de Mercancía de Almacén</option>
            </select>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Fecha y Hora</label>
            <Input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
              className="h-8 text-xs font-mono"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Valor Asociado / Canal</label>
            <Input
              value={eventValue}
              onChange={(e) => setEventValue(e.target.value)}
              placeholder="VERDE / Conforme / Sin incidencias"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Código de Referencia / Manifiesto</label>
            <Input
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              placeholder="MAN-2026-4581"
              className="h-8 text-xs font-mono"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Registrar Hito'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
