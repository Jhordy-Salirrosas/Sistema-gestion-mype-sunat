import { InvoiceMoneyInput } from '../components/InvoiceMoneyInput';
import { errorMontoDeposito, errorConstanciaDeposito } from '../lib/invoiceDepositValidation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { apiClient } from '@/lib/axios';
import { PeriodInput } from '@/components/common/PeriodInput';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';

interface Detraccion { id: string; numero: string; date: string; customer: string; total: number; detraction: number; depositedAt?: string | null; depositedAmount?: number | null; constancia?: string | null; }
const periodoActual = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; };

export default function InvoiceDetractionsPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(periodoActual);
  const [selected, setSelected] = useState<Detraccion | null>(null);
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), constancia: '' });
  const [error, setError] = useState('');
  const { data = [], isLoading } = useQuery({ queryKey: ['detractions', period], queryFn: async () => (await apiClient.get<Detraccion[]>('/invoices/detractions', { params: { period } })).data });
  const errorMonto = selected ? errorMontoDeposito(Number(form.amount), selected.detraction) : undefined;
  const errorConstancia = errorConstanciaDeposito(form.constancia);
  const registrar = useMutation({
    mutationFn: async () => {
      if (!selected || errorMonto || errorConstancia) throw new Error(errorMonto ?? errorConstancia ?? 'Seleccione un comprobante.');
      return (await apiClient.post(`/invoices/detractions/${selected.id}`, { amount: Number(form.amount), date: form.date, constancia: form.constancia })).data;
    },
    onSuccess: async () => { setSelected(null); setForm({ amount: '', date: new Date().toISOString().slice(0, 10), constancia: '' }); setError(''); await qc.invalidateQueries({ queryKey: ['detractions'] }); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo registrar el depósito.'),
  });
  return <Page>
    <PageHeader title="Detracciones" description="Control del depósito de detracción por comprobante" />
    <Card className="p-4 mb-4"><div className="flex flex-wrap items-end gap-3"><label className="text-xs">Período<PeriodInput value={period} onChange={setPeriod} /></label></div></Card>
    {error ? <Card className="p-3 mb-3 text-sm text-destructive">{error}</Card> : null}
    <Card flush><Table><TableHeader><TableRow><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead align="right">Total</TableHead><TableHead align="right">Detracción</TableHead><TableHead>Depósito</TableHead><TableHead>Constancia</TableHead><TableHead align="right">Acción</TableHead></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={8}>Cargando…</TableCell></TableRow> : null}
      {!isLoading && data.length === 0 ? <TableRow><TableCell colSpan={8}>Sin comprobantes con detracción en el período.</TableCell></TableRow> : null}
      {data.map((d) => <TableRow key={d.id}><TableCell className="font-mono text-xs">{d.numero}</TableCell><TableCell>{formatDateToPeru(d.date)}</TableCell><TableCell>{d.customer}</TableCell><TableCell align="right">{formatCurrency(d.total, 'PEN')}</TableCell><TableCell align="right">{formatCurrency(d.detraction, 'PEN')}</TableCell><TableCell>{d.depositedAt ? `${formatDateToPeru(d.depositedAt)} · ${formatCurrency(d.depositedAmount ?? 0, 'PEN')}` : 'Pendiente'}</TableCell><TableCell>{d.constancia ?? '—'}</TableCell><TableCell align="right"><Button size="sm" variant={d.depositedAt ? 'ghost' : 'outline'} onClick={() => { setSelected(d); setForm({ amount: String(d.depositedAmount ?? d.detraction), date: new Date().toISOString().slice(0, 10), constancia: d.constancia ?? '' }); }}>{d.depositedAt ? 'Actualizar' : 'Registrar'}</Button></TableCell></TableRow>)}
    </TableBody></Table></Card>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Depósito de detracción</DialogTitle><DialogDescription>{selected?.numero} · {selected?.customer} · Detracción {selected ? formatCurrency(selected.detraction, 'PEN') : ''}</DialogDescription></DialogHeader>
        <div className="space-y-3"><label className="text-xs block">Monto<InvoiceMoneyInput aria-invalid={Boolean(errorMonto)} aria-describedby="deposit-amount-error" value={Number(form.amount)} onValue={(amount) => setForm({ ...form, amount: String(amount) })} /></label>{errorMonto && <p id="deposit-amount-error" role="alert" className="text-xs text-destructive">{errorMonto}</p>}<label className="text-xs block">Fecha<Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="text-xs block">Constancia<Input inputMode="numeric" aria-invalid={Boolean(errorConstancia)} aria-describedby="deposit-constancia-error" value={form.constancia} onChange={(e) => setForm({ ...form, constancia: e.target.value })} /></label>{errorConstancia && <p id="deposit-constancia-error" role="alert" className="text-xs text-destructive">{errorConstancia}</p>}<Button onClick={() => registrar.mutate()} disabled={registrar.isPending || Boolean(errorMonto || errorConstancia)}>{registrar.isPending ? 'Guardando…' : 'Guardar depósito'}</Button></div>
      </DialogContent>
    </Dialog>
  </Page>;
}
