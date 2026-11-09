import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { invoicesApi } from '../services/invoicesApi';
import type { AgregadoFiscal } from '../types/invoiceAggregate.types';
export function InvoiceAggregateMonitor() {
  const [rows, setRows] = useState<AgregadoFiscal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(async () => { setOcupado(true); try { setRows(await invoicesApi.getAgregados()); setError(null); } catch (e) { setError(extractApiErrorMessage(e, 'No se pudieron cargar los agregados.')); } finally { setOcupado(false); } }, []);
  useEffect(() => { let vivo = true; void Promise.resolve().then(() => { if (vivo) void cargar(); }); return () => { vivo = false; }; }, [cargar]);
  const consultar = async (id: string) => {
    setOcupado(true);
    try { const r = await invoicesApi.consultarAgregado(id); setMensaje(r.motivo ?? `Consulta finalizada: ${r.status ?? 'sin estado'}`); await cargar(); }
    catch (e) { setError(extractApiErrorMessage(e, 'No se pudo consultar el ticket.')); }
    finally { setOcupado(false); }
  };
  return <Card><CardHeader><CardTitle>Envíos agregados RA / RC</CardTitle></CardHeader><CardContent className="space-y-3">
    <Button variant="outline" disabled={ocupado} onClick={() => void cargar()}>Actualizar agregados</Button>
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    {!rows.length && <p>No hay agregados registrados.</p>}
    {rows.map(r => <div key={r.id} className="rounded border p-3 space-y-1"><p>{r.identifier} · {r.state} · fecha {r.reference_date}</p><p>Ticket: {r.ticket ?? 'No disponible'} · Código: {r.result?.codigo ?? 'No informado'}</p><p>{r.result?.mensaje ?? r.error ?? 'Pendiente de resultado'}</p>{r.transport_uncertain && <p>Transporte incierto: revisión requerida.</p>}{r.ticket && !['ACCEPTED', 'REJECTED'].includes(r.state) && <Button disabled={ocupado} onClick={() => void consultar(r.identifier)}>Consultar ticket {r.identifier}</Button>}</div>)}
  </CardContent></Card>;
}
