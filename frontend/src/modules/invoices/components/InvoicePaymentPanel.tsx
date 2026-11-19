import { useState } from 'react';
import { Banknote, CreditCard, Smartphone, CalendarClock } from 'lucide-react';
import { Button, Input, PageText } from '@/components/ui';
import { MEDIOS_PAGO_VENTA, type MedioPagoVenta } from '../types/invoiceEmision.types';

const NOMBRES: Record<MedioPagoVenta, string> = {
  EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia', DEPOSITO: 'Depósito', CHEQUE: 'Cheque',
};
const ACCESOS = [
  { medio: 'EFECTIVO', Icono: Banknote },
  { medio: 'YAPE', Icono: Smartphone },
  { medio: 'TARJETA', Icono: CreditCard },
] as const;

interface Props {
  formaPago: 'Contado' | 'Credito';
  medioPago: MedioPagoVenta;
  creditoHabilitado: boolean;
  pagoDirecto: number;
  onCambiar: (forma: 'Contado' | 'Credito', medio?: MedioPagoVenta) => void;
}

/** Controles de presentación: la entrega y el vuelto nunca forman parte del borrador fiscal. */
export function InvoicePaymentPanel({ formaPago, medioPago, creditoHabilitado, pagoDirecto, onCambiar }: Props) {
  const [entregado, setEntregado] = useState('');
  const numeroEntregado = Number(entregado.replace(',', '.'));
  const centimosEntregados = Number.isFinite(numeroEntregado) ? Math.round(Math.max(0, numeroEntregado) * 100) : 0;
  const diferencia = centimosEntregados - Math.round(pagoDirecto * 100);
  const efectivo = formaPago === 'Contado' && medioPago === 'EFECTIVO';

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-2 text-xs font-medium">Medio de pago</legend>
      <div className="grid grid-cols-2 gap-2">
        {ACCESOS.map(({ medio, Icono }) => (
          <Button key={medio} type="button" variant={formaPago === 'Contado' && medioPago === medio ? 'default' : 'outline'}
            aria-pressed={formaPago === 'Contado' && medioPago === medio}
            className="h-auto min-w-0 flex-col gap-1 py-3" onClick={() => onCambiar('Contado', medio)}>
            <Icono aria-hidden="true" className="h-4 w-4" />{NOMBRES[medio]}
          </Button>
        ))}
        <Button type="button" variant={formaPago === 'Credito' ? 'default' : 'outline'}
          aria-pressed={formaPago === 'Credito'} disabled={!creditoHabilitado}
          className="h-auto min-w-0 flex-col gap-1 py-3" onClick={() => onCambiar('Credito')}>
          <CalendarClock aria-hidden="true" className="h-4 w-4" />Crédito
        </Button>
      </div>
      {!creditoHabilitado && <PageText variant="caption">El crédito requiere una factura y un cliente con crédito registrado en el maestro.</PageText>}
      {formaPago === 'Contado' && (
        <label className="block space-y-1.5 text-xs font-medium">
          Medio de pago
          <select aria-label="Medio de pago" className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={medioPago} onChange={e => onCambiar('Contado', e.target.value as MedioPagoVenta)}>
            {MEDIOS_PAGO_VENTA.map(medio => <option key={medio} value={medio}>{NOMBRES[medio]}</option>)}
          </select>
        </label>
      )}
      {efectivo && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0 space-y-2">
              <label htmlFor="monto-entregado" className="block text-xs font-medium">Monto entregado (S/)</label>
              <Input id="monto-entregado" type="text" inputMode="decimal" placeholder="0.00" autoComplete="off"
                value={entregado} onChange={e => setEntregado(e.target.value)} aria-describedby="entrega-ayuda" />
            </div>
            <div className="space-y-1 text-right" role="status" aria-label="Vuelto">
              <span className="block text-xs">Vuelto</span>
              <output htmlFor="monto-entregado" className="block text-lg font-semibold tabular-nums text-primary">S/ {(Math.max(0, diferencia) / 100).toFixed(2)}</output>
            </div>
          </div>
          {entregado && diferencia < 0 && <p className="text-xs">Pendiente de entregar: S/ {(Math.abs(diferencia) / 100).toFixed(2)}</p>}
          <p id="entrega-ayuda" className="text-xs text-muted-foreground">Referencia de caja sobre el pago directo. No modifica el comprobante.</p>
        </div>
      )}
    </fieldset>
  );
}
