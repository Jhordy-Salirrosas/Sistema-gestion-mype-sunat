import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { errorSerie } from '../lib/invoiceConfigurationValidation';
import { invoiceConfigError } from '../lib/invoiceConfigError';
export function InvoiceSeriesForm({ onSaved }: { onSaved?: () => Promise<unknown> }) {
 const admin = useAuthStore(s => s.user?.role === 'ADMIN');
 const [tipo, setTipo] = useState('01'), [serie, setSerie] = useState(''), [inicial, setInicial] = useState('0');
 const [error, setError] = useState(''), [saving, setSaving] = useState(false), [success, setSuccess] = useState('');
 if (!admin) return null;
 const submit = async (e: FormEvent) => { e.preventDefault(); setError(''); setSuccess('');
  const problema = errorSerie(tipo, serie, inicial);
  if (problema) { setError(problema); return; }
  setSaving(true); try { await apiClient.post('/invoices/series', { document_type: tipo, series: serie.trim().toUpperCase(), correlativo_inicial: Number(inicial) }); await onSaved?.(); setSuccess('Serie guardada; lista actualizada. Reactivar conserva la numeración.'); setSerie(''); }
  catch (e) { setError(invoiceConfigError(e)); } finally { setSaving(false); }
 };
 return <form aria-label="Crear serie" onSubmit={e => void submit(e)} className="space-y-2 rounded border p-3">
 <h3>Crear o reactivar serie</h3>
 <label>Tipo *<select aria-label="Tipo de la serie" required value={tipo} onChange={e => setTipo(e.target.value)}>{[['01','Factura'],['03','Boleta'],['07','Nota de crédito'],['08','Nota de débito']].map(([v,l]) => <option key={v} value={v}>{v} - {l}</option>)}</select></label>
 <label>Serie *<input aria-label="Nueva serie" required maxLength={4} value={serie} onChange={e => setSerie(e.target.value)} /></label>
 <label>Último correlativo usado *<input aria-label="Último correlativo usado" type="number" required min="0" max="99999999" step="1" value={inicial} onChange={e => setInicial(e.target.value)} /></label>
 <p>0 inicia en 1. Siguiente para una serie nueva: {inicial.trim() && Number.isInteger(Number(inicial)) && Number(inicial) >= 0 && Number(inicial) < 99999999 ? Number(inicial) + 1 : 'no disponible (correlativo inválido o serie agotada)'}. Reactivar no reinicia el correlativo.</p>
 {error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
 <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar serie'}</Button>
 </form>;
}
