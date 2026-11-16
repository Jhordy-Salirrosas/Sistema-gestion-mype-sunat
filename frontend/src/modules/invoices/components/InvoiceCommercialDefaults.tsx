import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { Button } from '@/components/ui';
import { useCommercialDefaults, type CommercialDefaults } from '../hooks/useCommercialDefaults';
export function InvoiceCommercialDefaults() {
  const query = useCommercialDefaults(); const client = useQueryClient();
  const [draft, setDraft] = useState<CommercialDefaults>(); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const value = draft ?? query.data;
  if (!value) return <p role={query.isError ? 'alert' : 'status'}>{query.isError ? 'No se pudo leer la configuración comercial.' : 'Consultando configuración comercial…'}</p>;
  return <section className="space-y-2 rounded-md border p-4" aria-label="Valores comerciales globales"><h2 className="font-semibold">Pago predeterminado de la empresa</h2>
    <label>Forma de pago<select aria-label="Forma de pago predeterminada" value={value.forma_pago} onChange={e => setDraft({ ...value, forma_pago: e.target.value as CommercialDefaults['forma_pago'] })}><option value="Contado">Contado</option><option value="Credito">Crédito</option></select></label>
    <label>Medio de pago<select aria-label="Medio de pago predeterminado" value={value.medio_pago} onChange={e => setDraft({ ...value, medio_pago: e.target.value as CommercialDefaults['medio_pago'] })}>{['EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA','DEPOSITO','CHEQUE'].map(m => <option key={m}>{m}</option>)}</select></label>
    <p className="text-xs">El crédito requiere un cliente habilitado y sus cuotas. La admisión de descuentos se mantiene en el maestro.</p>
    {error && <p role="alert">{error}</p>}<Button type="button" disabled={saving} onClick={async () => { setError(''); setSaving(true); try { await apiClient.put('/invoices/commercial-defaults', value); await client.invalidateQueries({ queryKey: ['invoice-commercial-defaults'] }); setDraft(undefined); } catch { setError('No se pudo guardar la configuración comercial.'); } finally { setSaving(false); } }}>Guardar pago predeterminado</Button>
  </section>;
}
