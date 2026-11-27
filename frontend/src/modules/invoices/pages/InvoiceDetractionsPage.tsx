import { fechaLimiteDetraccion, superaPlazoDetraccion, detraccionFueraDePlazo } from '../lib/invoiceDetractionDeadline';
import { hoyEnLima } from '../lib/invoiceFecha';
import './invoiceDetractionsPage.css';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { InvoiceUxPage as Page } from '../components/InvoiceUxPage';
import { InvoiceMoneyInput } from '../components/InvoiceMoneyInput';
import { errorMontoDeposito, errorConstanciaDeposito } from '../lib/invoiceDepositValidation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { apiClient } from '@/lib/axios';
import { PeriodInput } from '@/components/common/PeriodInput';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';

interface Deposit { id: string; date: string; amount: number; constancia: string | null; }
interface Detraccion { deposits?: Deposit[]; depositedTotal?: number; balance?: number; id: string; numero: string; date: string; customer: string; total: number; detraction: number; depositedAt?: string | null; depositedAmount?: number | null; constancia?: string | null; }
const periodoActual = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`; };

export default function InvoiceDetractionsPage() {
  const qc = useQueryClient();
  const [hoy] = useState(hoyEnLima);
  const [period, setPeriod] = useState(periodoActual);
  const [selected, setSelected] = useState<Detraccion | null>(null);
  const [editing, setEditing] = useState<Deposit | null>(null);
  const [choosing, setChoosing] = useState<Detraccion | null>(null);
  const balance = (d: Detraccion) => d.balance ?? Math.max(0, d.detraction - (d.depositedAmount ?? 0));
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), constancia: '' });
  const [error, setError] = useState('');
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['detractions', period], queryFn: async () => (await apiClient.get<Detraccion[]>('/invoices/detractions', { params: { period } })).data });
  const summary = data.reduce((sum, d) => ({
    detraction: sum.detraction + d.detraction,
    deposited: sum.deposited + (d.depositedTotal ?? d.depositedAmount ?? 0),
    balance: sum.balance + balance(d),
  }), { detraction: 0, deposited: 0, balance: 0 });
  const periodLabel = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`)).toLocaleLowerCase('es-PE') + ` ${period.slice(0, 4)}`;
  const limiteSeleccionado = selected ? fechaLimiteDetraccion(selected.date) : null;
  const fechaTardia = superaPlazoDetraccion(form.date, limiteSeleccionado);
  const fueraDePlazo = (d: Detraccion) => detraccionFueraDePlazo({ emision: d.date, pendiente: balance(d) > 0, depositos: d.deposits?.length ? d.deposits.map(deposit => deposit.date) : d.depositedAt ? [d.depositedAt] : [], hoy });
  const errorMonto = selected ? errorMontoDeposito(Number(form.amount), balance(selected) + (editing?.amount ?? 0)) : undefined;
  const errorConstancia = errorConstanciaDeposito(form.constancia);
  const registrar = useMutation({
    mutationFn: async () => {
      if (!selected || errorMonto || errorConstancia) throw new Error(errorMonto ?? errorConstancia ?? 'Seleccione un comprobante.');
      const url = `/invoices/detractions/${selected.id}`;
      const body = { amount: Number(form.amount), date: form.date, constancia: form.constancia };
      return (await (editing ? apiClient.put(`${url}/deposits/${editing.id}`, body) : apiClient.post(url, body))).data;
    },
    onSuccess: async () => { setSelected(null); setEditing(null); setForm({ amount: '', date: new Date().toISOString().slice(0, 10), constancia: '' }); setError(''); await qc.invalidateQueries({ queryKey: ['detractions'] }); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo registrar el depósito.'),
  });
  const open = (d: Detraccion, deposit: Deposit | null = null) => {
    setSelected(d); setEditing(deposit); setError('');
    setForm({ amount: String(deposit?.amount ?? balance(d)), date: deposit?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10), constancia: deposit?.constancia ?? '' });
  };
  return <Page className="m1-detractions">
    <PageHeader title="Detracciones" description="Control de depósitos de detracción por comprobante" />
    <Card className="detractions-period">
      <div className="detractions-period-controls"><span className="text-xs font-medium text-muted-foreground">Período</span><div className="detractions-period-input"><span aria-hidden="true">Año</span><span aria-hidden="true">Mes</span><PeriodInput value={period} onChange={setPeriod} /></div></div>
      <div className="detractions-summary" role="group" aria-label="Resumen del período">
        <span><strong>{data.length}</strong> comprobantes</span>
        <span>Detracción total <strong>{formatCurrency(summary.detraction, 'PEN')}</strong></span>
        <span>Depositado <strong>{formatCurrency(summary.deposited, 'PEN')}</strong></span>
        <span>Saldo pendiente <strong>{formatCurrency(summary.balance, 'PEN')}</strong></span>
      </div>
    </Card>
    {error ? <Card className="p-3 mb-3 text-sm">{error}</Card> : null}
    {isError && <p role="alert">No se pudieron consultar las detracciones. Reintente la consulta antes de registrar un depósito.</p>}
    <h2 className="text-base font-semibold">Comprobantes <span className="text-sm font-normal text-muted-foreground">· {periodLabel}</span></h2>
    <p className="text-xs text-muted-foreground">Plazo de referencia: quinto día hábil del mes siguiente a la emisión, de lunes a viernes y sin descontar feriados. El plazo legal también depende del pago y de la anotación en el Registro de Compras.</p>
    <Card flush><Table className="detractions-table">
      <caption className="sr-only">Depósitos y saldo de detracción por comprobante</caption>
      <colgroup>{[13, 8, 13, 7.5, 8, 19, 6, 8.5, 7, 10].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <TableHeader><TableRow><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead align="right">Total</TableHead><TableHead align="right">Detracción</TableHead><TableHead>Depósitos</TableHead><TableHead align="center">Editar</TableHead><TableHead align="right">Total depositado</TableHead><TableHead align="right">Saldo</TableHead><TableHead align="right">Acción</TableHead></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={10}>Cargando…</TableCell></TableRow> : null}
      {!isLoading && !isError && data.length === 0 ? <TableRow><TableCell colSpan={10}>No hay comprobantes con detracción en este periodo. Cambie el periodo o revise la bandeja.</TableCell></TableRow> : null}
      {data.map((d) => <TableRow key={d.id}>
        <TableCell><strong className="detractions-number">{d.numero}</strong><span className="detractions-status">{balance(d)<=0?<CheckCircle2 aria-hidden="true" className="h-3 w-3 shrink-0"/>:<Clock3 aria-hidden="true" className="h-3 w-3 shrink-0"/>}{balance(d)<=0?'Depositada':'Pendiente de depósito'}</span>{fueraDePlazo(d) && <div className="mt-1"><span className="detractions-status" title={`Fecha límite de referencia: ${formatDateToPeru(fechaLimiteDetraccion(d.date))}`}>Fuera de plazo</span></div>}</TableCell>
        <TableCell className="detractions-date">{formatDateToPeru(d.date)}</TableCell><TableCell className="detractions-customer">{d.customer}</TableCell>
        <TableCell align="right" className="detractions-money">{formatCurrency(d.total, 'PEN')}</TableCell><TableCell align="right" className="detractions-money">{formatCurrency(d.detraction, 'PEN')}</TableCell>
        <TableCell className="detractions-deposits">{d.deposits?.length ? <ul>{d.deposits.map(deposit => <li key={deposit.id}>
          <span className="whitespace-nowrap">{formatDateToPeru(deposit.date)} · <strong>{formatCurrency(deposit.amount, 'PEN')}</strong></span> · <span className="text-muted-foreground">Constancia N.º {deposit.constancia || '—'}</span>
        </li>)}</ul> : d.depositedAt ? `${formatDateToPeru(d.depositedAt)} · ${d.constancia || '—'}` : <span className="text-muted-foreground">Sin depósitos</span>}</TableCell>
        <TableCell align="center" className="detractions-edit">{Boolean(d.deposits?.length) && <Button size="sm" variant="outline" aria-label={`Editar depósitos de ${d.numero}`} onClick={() => { if (d.deposits?.length === 1) open(d, d.deposits[0]); else setChoosing(d); }}>Editar</Button>}</TableCell>
        <TableCell align="right" className="detractions-money">{formatCurrency(d.depositedTotal ?? d.depositedAmount ?? 0, 'PEN')}</TableCell><TableCell align="right" className={`detractions-money ${balance(d) > 0 ? 'font-semibold' : ''}`}>{formatCurrency(balance(d), 'PEN')}</TableCell>
        <TableCell align="right" className="detractions-action"><Button size="sm" variant={balance(d) > 0 && !d.depositedAt && !d.deposits?.length ? 'default' : 'outline'} disabled={balance(d) <= 0} onClick={() => open(d)}>{d.depositedAt || d.deposits?.length ? 'Agregar depósito' : 'Registrar'}</Button></TableCell>
      </TableRow>)}
    </TableBody></Table></Card>
    <Dialog open={choosing !== null} onOpenChange={(open) => { if (!open) setChoosing(null); }}>
      <DialogContent className="detractions-dialog"><DialogHeader><DialogTitle>Seleccionar depósito para editar</DialogTitle><DialogDescription>{choosing?.numero} · {choosing?.customer}</DialogDescription></DialogHeader>
        <ul className="space-y-2">{choosing?.deposits?.map(deposit => <li key={deposit.id}><Button variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" aria-label={`Editar depósito ${deposit.constancia || deposit.id}`} onClick={() => { open(choosing, deposit); setChoosing(null); }}>{formatDateToPeru(deposit.date)} · {formatCurrency(deposit.amount, 'PEN')} · Constancia N.º {deposit.constancia || '—'}</Button></li>)}</ul>
      </DialogContent>
    </Dialog>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="detractions-dialog"><DialogHeader><DialogTitle>{editing ? 'Editar depósito de detracción' : 'Registrar depósito de detracción'}</DialogTitle><DialogDescription>{selected?.numero} · {selected?.customer} · Detracción {selected ? formatCurrency(selected.detraction, 'PEN') : ''}</DialogDescription></DialogHeader>
        {fechaTardia && <div role="status" aria-label="Advertencia de plazo del depósito" className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
          <p>La fecha elegida supera el plazo legal de referencia ({formatDateToPeru(limiteSeleccionado)}). Un depósito fuera de plazo puede generar una multa del 50 % del importe no depositado oportunamente y postergar el uso del crédito fiscal.</p>
          <p className="text-muted-foreground">Referencia calculada desde la emisión, sin descontar feriados ni considerar un vencimiento anterior por pago o anotación en Compras. La advertencia no impide registrar el depósito real.</p>
        </div>}
        <div className="space-y-3">{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<label className="text-xs block">Monto<InvoiceMoneyInput aria-invalid={Boolean(errorMonto)} aria-describedby="deposit-amount-error" value={Number(form.amount)} onValue={(amount) => setForm({ ...form, amount: String(amount) })} /></label>{errorMonto && <p id="deposit-amount-error" role="alert" className="text-xs text-destructive">{errorMonto}</p>}<label className="text-xs block">Fecha<Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="text-xs block">Constancia<Input inputMode="numeric" aria-invalid={Boolean(errorConstancia)} aria-describedby="deposit-constancia-error" value={form.constancia} onChange={(e) => setForm({ ...form, constancia: e.target.value })} /></label>{errorConstancia && <p id="deposit-constancia-error" role="alert" className="text-xs text-destructive">{errorConstancia}</p>}<Button onClick={() => registrar.mutate()} disabled={registrar.isPending || Boolean(errorMonto || errorConstancia)}>{registrar.isPending ? 'Guardando…' : 'Guardar depósito'}</Button></div>
      </DialogContent>
    </Dialog>
  </Page>;
}
