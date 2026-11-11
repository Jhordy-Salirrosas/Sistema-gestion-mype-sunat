import { useState } from 'react';
import { Button, PageText } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '../services/invoicesApi';
import { ETIQUETA_TIPO, type VistaPreviaResumen } from '../lib/invoiceResumenes';
import type { SeleccionBaja } from '../types/invoiceAggregate.types';
import type { ResultadoEnvioAgregado } from '../types/invoiceEnvioAgregado.types';
export function EnviarBajaPanel({ fecha, vista, onEnviado }: { fecha: string; vista: VistaPreviaResumen; onEnviado: () => void }) {
  const [seleccion, setSeleccion] = useState<SeleccionBaja[]>([]);
  const [previa, setPrevia] = useState<{ key: string; vista: VistaPreviaResumen } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvioAgregado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(seleccion);
  const valida = previa?.key === key && Boolean(previa.vista.xml) && !previa.vista.errores.length && previa.vista.lineas.filter(l => l.incluido).length === seleccion.length;
  const cambiar = (lineas: SeleccionBaja[]) => { setSeleccion(lineas); setConfirmar(false); setPrevia(null); };
  const preview = async () => {
    setOcupado(true); setError(null);
    try { setPrevia({ key, vista: await invoicesApi.previsualizarBaja(fecha, seleccion) }); }
    catch (e) { setError(extractApiErrorMessage(e, 'No se pudo validar la selección de baja.')); }
    finally { setOcupado(false); }
  };
  const enviar = async () => {
    if (!valida || !seleccion.length || ocupado) return;
    setOcupado(true); setError(null);
    try { const r = await invoicesApi.enviarBaja(fecha, seleccion); setResultado(r); setConfirmar(false); if (r.enviado) { setSeleccion([]); setPrevia(null); onEnviado(); } }
    catch (e) { setError(extractApiErrorMessage(e, 'No se pudo preparar la baja.')); }
    finally { setOcupado(false); }
  };
  return <section aria-label="Selección de baja" className="space-y-3">
    <PageText variant="label">Seleccione documentos y motivo de cada baja</PageText>
    {vista.lineas.map(l => <div key={l.id ?? `${l.serie}-${l.correlativo}`} className="rounded border p-2 space-y-1">
      <label><input type="checkbox" disabled={!l.incluido || !l.id || ocupado} checked={seleccion.some(s => s.id === l.id)} aria-label={`Dar de baja ${l.serie}-${l.correlativo}`} onChange={e => cambiar(e.target.checked ? [...seleccion, { id: l.id!, motivo: 'Anulación de la operación' }] : seleccion.filter(s => s.id !== l.id))} /> {l.serie}-{l.correlativo} · {l.estado}</label>
      <PageText variant="caption">{ETIQUETA_TIPO[l.tipoComprobante] ?? l.tipoComprobante} ({l.tipoComprobante}) · Total: {l.total.toFixed(2)} · {l.estado}</PageText>
      {!l.incluido && <p className="text-sm">{l.motivoExclusion}</p>}
      {seleccion.some(s => s.id === l.id) && <label className="block text-sm">Motivo <input className="rounded border p-1 w-full" aria-label={`Motivo de baja ${l.serie}-${l.correlativo}`} disabled={ocupado} maxLength={100} value={seleccion.find(s => s.id === l.id)!.motivo} onChange={e => cambiar(seleccion.map(s => s.id === l.id ? { ...s, motivo: e.target.value } : s))} /></label>}
    </div>)}
    <Button disabled={!seleccion.length || ocupado || seleccion.some(s => !s.motivo.trim())} onClick={() => void preview()}>Ver XML de selección</Button>
    {previa?.key === key && <><p>{previa.vista.errores.join(' | ')}</p>{previa.vista.xml && <details open><summary>XML de los documentos seleccionados</summary><pre className="max-h-64 overflow-auto text-xs">{previa.vista.xml}</pre></details>}</>}
    {!confirmar ? <Button disabled={!valida || ocupado} onClick={() => setConfirmar(true)}>Enviar baja a SUNAT</Button> : <div className="rounded border p-3 space-y-2"><p>Confirmar baja de {seleccion.length} documento(s). La anulación se registra cuando SUNAT la acepta.</p><Button disabled={ocupado} onClick={() => void enviar()}>{ocupado ? 'Preparando…' : 'Confirmar baja en SUNAT'}</Button><Button variant="outline" disabled={ocupado} onClick={() => setConfirmar(false)}>Cancelar</Button></div>}
    {resultado && <p role="status">{resultado.enviado ? `Baja ${resultado.identificador} encolada (${resultado.jobId}). Consulte ticket y resultado en el Monitor.` : resultado.motivo ?? 'La baja no se encoló.'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
