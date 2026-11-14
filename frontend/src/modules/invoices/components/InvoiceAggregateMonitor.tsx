import { InvoiceLastUpdated } from './InvoiceLastUpdated';
import { InvoiceWriteButton } from './InvoiceWriteButton';
import { InvoiceCdrModal } from './InvoiceCdrModal';
import { aComprobanteDemo } from '../lib/invoiceApiMapper';
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '../services/invoicesApi';
import type { AgregadoFiscal } from '../types/invoiceAggregate.types';
export function InvoiceAggregateMonitor() {
  const [detalle, setDetalle] = useState<ComprobanteDemo | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const abrir = async (id: string) => {
    setAbriendo(id); setError(null);
    try { setDetalle(aComprobanteDemo(await invoicesApi.getInvoiceById(id))); }
    catch (e) { setError(extractApiErrorMessage(e, 'No se pudo abrir el comprobante del agregado.')); }
    finally { setAbriendo(null); }
  };
  const [rows, setRows] = useState<AgregadoFiscal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [cargado, setCargado] = useState(false);
  const [consultando, setConsultando] = useState<string | null>(null);
  const cargar = useCallback(async () => { setOcupado(true); try { setRows(await invoicesApi.getAgregados()); setCargado(true); setError(null); setActualizado(new Date()); } catch (e) { setError(extractApiErrorMessage(e, 'No se pudieron cargar los agregados.')); } finally { setOcupado(false); } }, []);
  useEffect(() => { let vivo = true; void Promise.resolve().then(() => { if (vivo) void cargar(); }); return () => { vivo = false; }; }, [cargar]);
  const consultar = async (id: string) => {
    setOcupado(true); setConsultando(id); setMensaje(null); setError(null);
    try { const r = await invoicesApi.consultarAgregado(id); setMensaje(r.motivo ?? `Consulta finalizada: ${r.status ?? 'sin estado'}`); await cargar(); }
    catch (e) { setError(extractApiErrorMessage(e, 'No se pudo consultar el ticket.')); }
    finally { setOcupado(false); setConsultando(null); }
  };
  return <Card><CardHeader><CardTitle>Envíos agregados RA / RC</CardTitle></CardHeader><CardContent className="space-y-3">
    <Button variant="outline" disabled={ocupado} onClick={() => void cargar()}>Actualizar agregados</Button>
    <InvoiceLastUpdated fecha={actualizado} seccion="agregados" />
    {consultando && <p role="status">Consultando… {consultando}</p>}
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    {ocupado && !consultando && <p role="status">Cargando agregados…</p>}
    {cargado && !ocupado && !error && !rows.length && <p>No hay agregados registrados.</p>}
    {rows.map(r => <div key={r.id} className="rounded border p-3 space-y-1"><p>{r.identifier} · {r.state} · fecha {r.reference_date}</p><p>Ticket: {r.ticket ?? 'No disponible'} · Código: {r.result?.codigo ?? 'No informado'}</p><p>{r.result?.mensaje ?? r.error ?? 'Pendiente de resultado'}</p>{Boolean(r.bridge_reversal?.pending) && <p>ANULADO con reversión pendiente · {r.bridge_reversal?.pending} documentos. El envío está aceptado.</p>}{r.polling && <p>Sondeos automáticos: {r.polling.attempts}/24. {r.polling.inProgress ? 'Consulta en curso.' : r.polling.exhausted ? 'Automático agotado; puede consultar el ticket manualmente.' : r.polling.historyUnknown ? 'Revisión manual: no se pudo recuperar el contador de sondeos.' : r.polling.nextAt ? `Próxima consulta: ${new Date(r.polling.nextAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}` : ''}</p>}<div aria-label={`Comprobantes de ${r.identifier}`}>
      {(r.members ?? []).map(m => <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
        <span>{m.numero} · tipo {m.tipo} · monto {m.monto.toFixed(2)} · {m.estado}</span>
        <Button size="sm" variant="outline" disabled={abriendo !== null} onClick={() => void abrir(m.id)}>{abriendo === m.id ? 'Abriendo…' : `Ver comprobante ${m.numero}`}</Button>
      </div>)}
      {!r.members?.length && <p className="text-xs">Sin miembros disponibles en este listado.</p>}
    </div>{r.transport_uncertain && <p>Transporte incierto: revisión requerida.</p>}{r.ticket && !['ACCEPTED', 'REJECTED'].includes(r.state) && <InvoiceWriteButton disabled={ocupado} onClick={() => void consultar(r.identifier)}>{consultando === r.identifier ? 'Consultando…' : `Consultar ticket ${r.identifier}`}</InvoiceWriteButton>}</div>)}
    {detalle && <InvoiceCdrModal comprobante={detalle} onCerrar={() => setDetalle(null)} />}
  </CardContent></Card>;
}
