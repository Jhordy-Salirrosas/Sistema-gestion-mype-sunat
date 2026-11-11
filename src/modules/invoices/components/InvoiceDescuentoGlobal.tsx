import { InvoiceMoneyInput } from './InvoiceMoneyInput';
import type { DescuentoGlobal } from '../lib/invoiceDescuentoGlobal';

export const InvoiceDescuentoGlobal = ({
  valor,
  onChange,
  disabled = false,
}: {
  valor: DescuentoGlobal | null | undefined;
  onChange: (valor: DescuentoGlobal | null) => void;
  disabled?: boolean;
}) => (
  <div className="space-y-1 sm:col-span-2">
    <label className="text-sm font-medium" htmlFor="descuento-global">Descuento global (Catálogo 53)</label>
    <div className="flex gap-2">
      <select id="descuento-global" disabled={disabled} className="h-9 rounded border bg-background px-2 text-sm" value={valor?.codigo ?? ''}
        onChange={(e) => onChange(e.target.value ? { codigo: e.target.value as '02' | '03', monto: valor?.monto ?? 0 } : null)}>
        <option value="">Sin descuento global</option>
        <option value="02">02 - Afecta la base IGV</option>
        <option value="03">03 - No afecta la base IGV</option>
      </select>
      {valor && <InvoiceMoneyInput aria-label="Monto del descuento global" disabled={disabled} className="h-9 rounded border bg-background px-2 text-sm" value={valor.monto} onValue={monto => onChange({ ...valor, monto })} />}
    </div>
    {disabled && <p className="text-xs text-muted-foreground">El descuento solo se habilita para clientes que admiten descuento en el maestro de terceros.</p>}
    {valor?.codigo === '03' && <p className="text-xs text-amber-700">El asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</p>}
  </div>
);
