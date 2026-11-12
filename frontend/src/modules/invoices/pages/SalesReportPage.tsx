import { errorRangoFechas } from '../lib/invoiceDateRange';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { apiClient } from '@/lib/axios';
import { formatCurrency } from '@/lib/formatters';

interface Reporte {
  from: string; to: string;
  totals: { sales: number; taxable: number; igv: number; cost: number; profit: number; margin: number; documents: number; withoutCost: { count: number; sales: number } };
  byCustomer: Array<{ document: string; customer: string; sales: number; cost: number; profit: number | null; documents: number }>;
  byDocument: Array<{ id: string; number: string; date: string; customer: string; total: number; cost: number; profit: number | null; hasCost: boolean }>;
  daily: Array<{ date: string; sales: number; cost: number; profit: number | null }>;
}

const inicioMes = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`; };
const hoy = () => new Date().toISOString().slice(0, 10);
const pct = (n: number) => `${n.toFixed(2)} %`;

const csv = (nombre: string, filas: Array<Array<string | number>>) => {
  const contenido = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click(); URL.revokeObjectURL(url);
};

export default function SalesReportPage() {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoy);
  const [tab, setTab] = useState<'clientes' | 'documentos' | 'dias'>('clientes');
  const errorFechas = !desde || !hasta ? 'Indique Desde y Hasta.' : errorRangoFechas(desde, hasta);
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-report', desde, hasta],
    enabled: !errorFechas,
    queryFn: async () => (await apiClient.get<Reporte>('/invoices/reports/sales', { params: { from: desde, to: hasta } })).data,
  });
  const filas = useMemo(() => {
    if (!data) return [];
    if (tab === 'clientes') return data.byCustomer.map((c) => [c.document, c.customer, c.documents, c.sales.toFixed(2), c.cost.toFixed(2), c.profit === null ? 'Sin costo' : c.profit.toFixed(2)]);
    if (tab === 'documentos') return data.byDocument.map((d) => [d.number, d.date, d.customer, d.total.toFixed(2), d.cost.toFixed(2), d.profit === null ? 'Sin costo' : d.profit.toFixed(2), d.hasCost ? 'Con costo' : 'Sin costo']);
    return data.daily.map((d) => [d.date, d.sales.toFixed(2), d.cost.toFixed(2), d.profit === null ? 'Sin costo' : d.profit.toFixed(2)]);
  }, [data, tab]);

  return <Page>
    <PageHeader title="Reporte de ventas y margen" description="Ventas del período, costo de ventas y utilidad por cliente, comprobante y día">
      <Button variant="outline" size="sm" disabled={!data || Boolean(errorFechas)} onClick={() => data && csv(`ventas-${data.from}-${data.to}.csv`, [['Reporte', 'Ventas', 'Costo', 'Utilidad'], ['TOTAL', data.totals.sales.toFixed(2), data.totals.cost.toFixed(2), data.totals.profit.toFixed(2)], ...filas])}>Exportar CSV</Button>
    </PageHeader>
    <Card className="p-4 mb-4"><div className="flex flex-wrap items-end gap-3">
      <label className="text-xs">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
      <label className="text-xs">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
    </div></Card>
    {errorFechas && <p role="alert" className="text-sm text-destructive">{errorFechas}</p>}
    {error ? <Card className="p-4 mb-4 text-sm text-destructive">No se pudo cargar el reporte. Revisa el rango de fechas.</Card> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        {[['Ventas', formatCurrency(data.totals.sales, 'PEN')], ['Base', formatCurrency(data.totals.taxable, 'PEN')], ['IGV', formatCurrency(data.totals.igv, 'PEN')], ['Costo', formatCurrency(data.totals.cost, 'PEN')], ['Utilidad', `${formatCurrency(data.totals.profit, 'PEN')} · ${pct(data.totals.margin)}`]].map(([k, v]) => <Card key={k} className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></Card>)}
      </div>
      {data.totals.withoutCost.count > 0 ? <Card className="p-3 mb-4 text-xs text-amber-600">{data.totals.withoutCost.count} comprobantes sin costo registrado por {formatCurrency(data.totals.withoutCost.sales, 'PEN')}. El margen excluye esas ventas.</Card> : null}
      <div className="flex gap-1 mb-3">{([['clientes', 'Clientes'], ['documentos', 'Comprobantes'], ['dias', 'Días']] as const).map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? 'default' : 'ghost'} onClick={() => setTab(k)}>{l}</Button>)}</div>
      <Card flush><Table><TableHeader><TableRow>
        {tab === 'clientes' ? <><TableHead>Documento</TableHead><TableHead>Cliente</TableHead><TableHead align="right">Docs</TableHead><TableHead align="right">Ventas</TableHead><TableHead align="right">Costo</TableHead><TableHead align="right">Utilidad</TableHead></> : null}
        {tab === 'documentos' ? <><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead align="right">Venta</TableHead><TableHead align="right">Costo</TableHead><TableHead align="right">Utilidad</TableHead><TableHead>Estado costo</TableHead></> : null}
        {tab === 'dias' ? <><TableHead>Fecha</TableHead><TableHead align="right">Ventas</TableHead><TableHead align="right">Costo</TableHead><TableHead align="right">Utilidad</TableHead></> : null}
      </TableRow></TableHeader><TableBody>
        {isLoading ? <TableRow><TableCell colSpan={7}>Cargando…</TableCell></TableRow> : null}
        {!isLoading && filas.length === 0 ? <TableRow><TableCell colSpan={7}>Sin ventas en el rango.</TableCell></TableRow> : null}
        {filas.map((f, i) => <TableRow key={i}>{f.map((v, j) => <TableCell key={j} align={j >= 2 && tab !== 'documentos' ? 'right' : j >= 3 ? 'right' : 'left'}>{typeof v === 'number' ? v : String(v)}</TableCell>)}</TableRow>)}
      </TableBody></Table></Card>
    </> : null}
  </Page>;
}
