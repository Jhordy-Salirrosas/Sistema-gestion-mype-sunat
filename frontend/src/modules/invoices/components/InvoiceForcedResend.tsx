import { useState } from 'react';
import { Button } from '@/components/ui';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { apiClient } from '@/lib/axios';
import { extractApiErrorMessage } from '@/lib/apiErrors';
export function InvoiceForcedResend({ id, incierto }: { id: string; incierto: boolean }) {
 const { isAdmin: admin } = useRolePermissions();
 const [decisionId, setDecisionId] = useState(() => crypto.randomUUID());
 const [renovar, setRenovar] = useState<string>();
 const [anterior, setAnterior] = useState<string>();
 const [motivo, setMotivo] = useState(''), [confirmado, setConfirmado] = useState(false), [busy, setBusy] = useState(false), [mensaje, setMensaje] = useState(''), [error, setError] = useState('');
 if (!admin || !incierto) return null;
 const enviar = async () => { if (busy || !motivo.trim() || !confirmado) return; setBusy(true); setError('');
  try { const r = await apiClient.post<{ mensaje: string; resultadoCola: string; autorizacionId?: string; requiereNuevaDecision?: boolean }>(`/invoices/${encodeURIComponent(id)}/forzar-reenvio`, { motivo: motivo.trim(), confirmado: true, decisionId, ...(renovar ? { renovarAutorizacionId: renovar } : {}) }); if (r.data.requiereNuevaDecision) setAnterior(r.data.autorizacionId); setMensaje(`${r.data.mensaje} Cola: ${r.data.resultadoCola}`); }
  catch(e) { setError(extractApiErrorMessage(e, 'No se pudo registrar la decisión.')); } finally { setBusy(false); }
 };
 return <section aria-label="Reenvío forzado con constancia" className="space-y-2 rounded border p-3">
 <h3>Reenvío forzado por decisión registrada</h3><p>Solo para incertidumbre de transporte. Existe riesgo de duplicidad si SUNAT ya recibió el comprobante. La compuerta local sigue vigente.</p>
 <label>Motivo escrito *<textarea aria-label="Motivo del reenvío forzado" maxLength={1000} aria-required="true" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
 <label><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Confirmo explícitamente el riesgo y autorizo un nuevo intento</label>
 <Button type="button" disabled={busy || !motivo.trim() || !confirmado} onClick={() => void enviar()}>{busy ? 'Registrando…' : 'Autorizar reenvío forzado'}</Button>
 {anterior && <Button type="button" disabled={busy} onClick={() => { setRenovar(anterior); setAnterior(undefined); setDecisionId(crypto.randomUUID()); setMotivo(''); setConfirmado(false); setMensaje('Escriba el nuevo motivo y confirme otra vez para registrar una decisión nueva.'); }}>Preparar una nueva decisión explícita</Button>}
 {mensaje && <p role="status">{mensaje}</p>}{error && <p role="alert">{error}</p>}
 </section>;
}
