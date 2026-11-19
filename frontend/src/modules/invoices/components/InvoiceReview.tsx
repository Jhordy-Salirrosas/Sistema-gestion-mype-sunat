import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import type { ItemBorrador } from '../lib/invoiceItems';
export function InvoiceReview({ open, close, confirm, change, cliente, items, total, pago, importes }: {
 open:boolean;close:()=>void;confirm:()=>void;change:(selector:string)=>void;cliente:string;items:readonly ItemBorrador[];total:number;pago:string;importes?:{base:number;igv:number;icbper:number;detraccion:number;retencion:number};
}) {
 return <Dialog open={open} onOpenChange={v=>{if(!v)close();}}><DialogContent className="m1-ux max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Revisar y emitir</DialogTitle><DialogDescription>Revise el comprobante antes de confirmar su emisión.</DialogDescription></DialogHeader>
  <section><h3 className="font-semibold">Cliente</h3><p>{cliente}</p><Button variant="link" onClick={()=>change('#doc-cliente')}>Cambiar cliente</Button></section>
  <section><h3 className="font-semibold">Ítems</h3><ul>{items.map(i=><li key={i.clave}>{i.codigo} · {i.descripcion} · {i.cantidad} {i.unidad}</li>)}</ul><Button variant="link" onClick={()=>change('[aria-label="Buscar producto"]')}>Cambiar ítems</Button></section>
  <section><h3 className="font-semibold">Totales</h3>{importes&&<dl className="space-y-1 text-sm">{[['Base imponible',importes.base],['Impuesto General a las Ventas (IGV)',importes.igv],['Impuesto al Consumo de las Bolsas de Plástico (ICBPER)',importes.icbper],['Detracción',importes.detraccion],['Retención',importes.retencion]].map(([nombre,monto])=><div key={String(nombre)} className="flex justify-between gap-2"><dt>{nombre}</dt><dd>S/ {Number(monto).toFixed(2)}</dd></div>)}</dl>}<p>Importe total: S/ {total.toFixed(2)}</p><Button variant="link" onClick={()=>change('#emision-liquidacion')}>Cambiar totales</Button></section>
  <section><h3 className="font-semibold">Medio de pago</h3><p>{pago.charAt(0).toUpperCase()+pago.slice(1).toLowerCase()}</p><Button variant="link" onClick={()=>change('[aria-label="Medio de pago"], #emision-cuotas')}>Cambiar pago</Button></section>
  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={close}>Volver al formulario</Button><Button onClick={confirm}>Confirmar emisión</Button></div>
 </DialogContent></Dialog>;
}
