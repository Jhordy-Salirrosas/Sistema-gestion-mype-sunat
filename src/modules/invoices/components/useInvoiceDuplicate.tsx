import { useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui';
import { itemDesdeProducto, type ItemBorrador } from '../lib/invoiceItems';
import type { ProductoBuscado } from '../lib/invoiceSearch';
export function condicionesFusionables(a: ItemBorrador, b: ItemBorrador) {
 const fiscal = (i: ItemBorrador) => [i.unidad, i.codigoAfectacion ?? i.afectacion, i.precioUnitario, i.valorUnitario, i.descuento ?? null, i.icbper, i.codigoDetraccion ?? null];
 return a.codigo.trim() === b.codigo.trim() && JSON.stringify(fiscal(a)) === JSON.stringify(fiscal(b));
}
export function useInvoiceDuplicate(items: readonly ItemBorrador[], cambiar: (i: number, p: Partial<ItemBorrador>) => void,
 eliminar: (i: number) => void, agregar?: (p: ProductoBuscado) => void, nota = false) {
 const previos = useRef<Record<number, string>>({});
 const [decision, setDecision] = useState<{ existente: number; linea: ItemBorrador; producto?: ProductoBuscado; indice?: number } | null>(null);
 const cancelar = () => { if (decision?.indice !== undefined) cambiar(decision.indice, { codigo: previos.current[decision.indice] ?? '' }); setDecision(null); };
 const elegir = (producto: ProductoBuscado) => {
  const existente = items.findIndex(i => i.codigo.trim() === producto.sku.trim());
  if (nota || existente < 0) return agregar?.(producto);
  try { setDecision({ existente, linea: itemDesdeProducto(producto, 'nueva'), producto }); } catch { agregar?.(producto); }
 };
 const confirmarCodigo = (indice: number) => {
  if (nota || items[indice].codigo === previos.current[indice]) return;
  const existente = items.findIndex((i, n) => n !== indice && i.codigo.trim() && i.codigo.trim() === items[indice].codigo.trim());
  if (existente >= 0) setDecision({ existente, linea: items[indice], indice });
 };
 const compatible = decision && condicionesFusionables(items[decision.existente], decision.linea);
 const dialogo = decision && <Dialog open onOpenChange={open => { if (!open) cancelar(); }}><DialogContent>
  <DialogTitle>Producto ya presente: {decision.linea.codigo}</DialogTitle>
  <DialogDescription>Cantidad actual {items[decision.existente].cantidad}; nueva {decision.linea.cantidad}; fusionada {items[decision.existente].cantidad + decision.linea.cantidad}.</DialogDescription>
  {!compatible && <p role="alert">No se pueden fusionar: precio, unidad o condiciones fiscales/comerciales diferentes.</p>}
  <Button type="button" disabled={!compatible} onClick={() => { cambiar(decision.existente, { cantidad: items[decision.existente].cantidad + decision.linea.cantidad }); if (decision.indice !== undefined) eliminar(decision.indice); setDecision(null); }}>Fusionar cantidades</Button>
  <Button type="button" onClick={() => { if (decision.producto) agregar?.(decision.producto); setDecision(null); }}>Mantener separada</Button>
  <Button type="button" variant="outline" onClick={cancelar}>Cancelar</Button>
 </DialogContent></Dialog>;
 return { elegir, recordarCodigo: (i: number) => { previos.current[i] = items[i].codigo; }, confirmarCodigo, dialogo };
}
