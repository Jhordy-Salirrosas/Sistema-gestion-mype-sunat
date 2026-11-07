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
import { type AddLocalExpensePayload, type ProrationMethod } from '../types';

interface AddLocalExpenseModalProps {
  shipmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AddLocalExpensePayload) => Promise<unknown>;
}

export const AddLocalExpenseModal: React.FC<AddLocalExpenseModalProps> = ({
  shipmentId,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [ruc, setRuc] = useState('20501234567');
  const [name, setName] = useState('APM Terminals Callao S.A.');
  const [concept, setConcept] = useState('ALMACENAJE_PORTUARIO');
  const [serial, setSerial] = useState('F001-00045812');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [netAmount, setNetAmount] = useState(2500);
  const [igvAmount, setIgvAmount] = useState(450);
  const [method, setMethod] = useState<ProrationMethod>('PESO_BRUTO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNetChange = (val: number) => {
    setNetAmount(val);
    setIgvAmount(Number((val * 0.18).toFixed(2)));
  };

  const total = Number((netAmount + igvAmount).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        shipment_id: shipmentId,
        supplier_ruc: ruc,
        supplier_name: name,
        expense_concept: concept,
        invoice_serial_number: serial,
        issue_date: date,
        net_amount_pen: netAmount,
        igv_amount_pen: igvAmount,
        total_amount_pen: total,
        is_capitalizable: true,
        proration_method: method,
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
          <DialogTitle className="text-base font-bold">
            Registrar Factura Local de Desaduanaje (NIC 2)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground block mb-1">RUC Proveedor Local</label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} maxLength={11} required className="h-8 text-xs font-mono" />
            </div>
            <div>
              <label className="font-semibold text-foreground block mb-1">Concepto de Gasto</label>
              <select value={concept} onChange={(e) => setConcept(e.target.value)} className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background">
                <option value="ALMACENAJE_PORTUARIO">Almacenaje Portuario</option>
                <option value="HONORARIOS_AGENCIA">Comisión Agencia de Aduana</option>
                <option value="TRANSPORTE_LOCAL">Flete y Transporte Local</option>
                <option value="CUADRILLA_ESTIBA">Cuadrilla de Estiba</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Razón Social del Proveedor</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-foreground block mb-1">Serie y Número</label>
              <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="F001-12345" required className="h-8 text-xs font-mono" />
            </div>
            <div>
              <label className="font-semibold text-foreground block mb-1">Fecha Emisión</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/20">
            <div>
              <label className="text-[10px] font-bold text-foreground block">Neto (Al Costo)</label>
              <Input type="number" step="0.01" value={netAmount} onChange={(e) => handleNetChange(parseFloat(e.target.value) || 0)} required className="h-7 text-xs font-mono font-bold text-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-emerald-600 block">IGV (Crédito Fiscal)</label>
              <Input type="number" step="0.01" value={igvAmount} onChange={(e) => setIgvAmount(parseFloat(e.target.value) || 0)} required className="h-7 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block">Total Factura</label>
              <Input type="number" step="0.01" value={total} readOnly className="h-7 text-xs font-mono bg-background/50" />
            </div>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Criterio de Prorrateo NIC 2</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as ProrationMethod)} className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium">
              <option value="PESO_BRUTO">Por Peso Bruto (Fletes y Almacenaje)</option>
              <option value="VALOR_FOB">Por Valor FOB (Comisiones de Agencia)</option>
              <option value="UNIDADES">Por Unidades Físicas</option>
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Cargar Factura'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
