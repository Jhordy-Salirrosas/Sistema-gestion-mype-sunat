import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { InvoiceUxPage as Page } from '../components/InvoiceUxPage';
import { InvoicePriorityNotice } from '../components/InvoicePriorityNotice';
import { InvoiceWait } from '../components/InvoiceWait';
import { PeriodInput } from '@/components/common/PeriodInput';
import { invoicesApi } from '../services/invoicesApi';
import { periodoActual } from '../lib/invoiceMetricsPeriodo';
const money = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function InvoicesDashboardPage() {
 const [period,setPeriod]=useState(periodoActual);
 const metricas=useQuery({queryKey:['invoices-dashboard-metrics',period],queryFn:()=>invoicesApi.getMetrics(period)});
 const alertas=useQuery({queryKey:['invoices-dashboard-alertas'],queryFn:()=>invoicesApi.getAlertas()});
 const m=metricas.data,a=alertas.data;
 const fin=new Date(Number(period.slice(0,4)),Number(period.slice(5,7)),0).getDate();
 const link=(estado='TODOS')=>`/invoices/facturas?${new URLSearchParams({m1:'1',incluir_notas:'1',desde:`${period}-01`,hasta:`${period}-${fin}`,estado})}`;
 const kpis=[
  {label:'Facturado neto',value:money(m?.facturado??0),Icon:TrendingUp,estado:'ACEPTADAS'},
  {label:'Comprobantes registrados (total)',value:m?.total??'—',Icon:FileText,estado:'TODOS'},
  {label:'Aceptadas y aceptadas con observación',value:m?.aceptados??0,Icon:CheckCircle2,estado:'ACEPTADAS'},
  {label:'Sin respuesta definitiva',value:m?.pendientes??0,Icon:Clock,estado:'PENDIENTES'},
  {label:'Rechazadas',value:m?.rechazados??0,Icon:AlertTriangle,estado:'RECHAZADO'},
  {label:'Tasa de aceptación',value:`${(m?.tasaAceptacion??0).toFixed(1)} %`,Icon:Activity,estado:'ACEPTADAS'},
 ];
 return <Page>
  <PageHeader title="Resumen de facturación" />
  <InvoicePriorityNotice notices={[
   m&&m.rechazados>0?{priority:100,title:'Comprobantes rechazados: requieren corrección',text:`Hay ${m.rechazados} en el periodo. Abra la bandeja filtrada y revise el motivo antes de corregir.`}:null,
   a&&a.dlq.pendientes>0?{priority:95,title:'Envíos que requieren revisión',text:a.dlq.mensaje}:null,
   a&&a.certificado.gravedad!=='OK'?{priority:a.certificado.gravedad==='CRITICO'?90:40,title:'Certificado digital',text:a.certificado.mensaje+(a.certificado.venceEl?` Vence: ${a.certificado.venceEl}.`:'')}:null,
   a?.antiguedad&&a.antiguedad.gravedad!=='OK'?{priority:85,title:'Plazo de envío a SUNAT',text:a.antiguedad.mensaje}:null,
   metricas.isError?{priority:80,title:'Indicadores no disponibles',text:'No se pudieron cargar los indicadores. Actualice la consulta.'}:null,
   alertas.isError?{priority:80,title:'Alertas no disponibles',text:'No se pudo consultar el certificado y la cola; no se confirma su estado.'}:null,
  ]} />
  <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-xs" htmlFor="invoices-dashboard-period">Periodo<PeriodInput id="invoices-dashboard-period" value={period} onChange={setPeriod}/></label></div>
  <p className="text-sm text-muted-foreground">Total de documentos del periodo. El neto considera facturas y boletas aceptadas, resta notas de crédito y suma notas de débito.</p>
  {metricas.isPending?<InvoiceWait label="Cargando indicadores…" skeleton/>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {kpis.map(({label,value,Icon,estado})=><Link key={label} to={link(estado)} aria-label={`Ver ${label.toLowerCase()} del periodo`} className="rounded-lg focus-visible:outline-2"><Card className="h-full p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><Icon aria-hidden="true" className="h-4 w-4"/></div><p className="mt-2 text-2xl font-bold">{m?value:'No disponible'}</p><span className="mt-2 text-xs underline">Ver comprobantes del periodo</span></Card></Link>)}
  </div>}
  <p className="text-xs text-muted-foreground">La bandeja abre con el periodo y el estado visibles. La vista enlazada incluye las notas para conservar el alcance de estas cifras; puede quitar ese filtro.</p>
  <nav aria-label="Accesos de facturación" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
   ['Emitir comprobante','/invoices/emision'],['Facturas y boletas','/invoices/facturas'],['Monitor de envíos y Constancia de Recepción (CDR)','/invoices/monitor'],['Notas de crédito y débito','/invoices/notas'],['Anulación y resúmenes','/invoices/bajas'],['Configuración','/invoices/configuracion'],
  ].map(([title,to])=><Link key={to} to={to} className="rounded-lg border bg-card p-4 text-sm font-semibold hover:bg-muted/40">{title}</Link>)}</nav>
 </Page>;
}
