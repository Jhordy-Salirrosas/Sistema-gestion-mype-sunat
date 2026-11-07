import type { DescuentoGlobal } from '../lib/invoiceDescuentoGlobal';

export const InvoiceDescuentoGlobal = ({ valor, onChange }: { valor: DescuentoGlobal | null | undefined; onChange: (valor: DescuentoGlobal | null) => void }) => (
  <div className="space-y-1 sm:col-span-2">
    <label className="text-sm font-medium" htmlFor="descuento-global">Descuento global (Catálogo 53)</label>
    <div className="flex gap-2">
      <select id="descuento-global" className="h-9 rounded border bg-background px-2 text-sm" value={valor?.codigo ?? ''}
        onChange={(e) => onChange(e.target.value ? { codigo: e.target.value as '02' | '03', monto: valor?.monto ?? 0 } : null)}>
        <option value="">Sin descuento global</option>
        <option value="02">02 - Afecta la base IGV</option>
        <option value="03">03 - No afecta la base IGV</option>
      </select>
      {valor && <input aria-label="Monto del descuento global" type="number" min="0" step="0.01" className="h-9 rounded border bg-background px-2 text-sm" value={valor.monto} onChange={(e) => onChange({ ...valor, monto: Number(e.target.value) })} />}
    </div>
    {valor?.codigo === '03' && <p className="text-xs text-amber-700">El asiento automático utiliza la cuenta 74. Podría quedar pendiente de revisión si la cuenta no está activa en el plan de la empresa o los importes no concuerdan.</p>}
  </div>
);
