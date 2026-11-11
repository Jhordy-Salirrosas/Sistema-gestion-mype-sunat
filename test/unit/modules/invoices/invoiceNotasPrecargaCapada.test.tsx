import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lineasParaNota } from '@/modules/invoices/lib/invoiceLineasOrigen';
import { precargarCantidadesNota, limitesNota } from '@/modules/invoices/lib/invoiceNoteQuantities';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { apiClient } from '@/lib/axios';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const origen = [2,3].map(cantidad => ({ codigo:'CEM-001', descripcion:'Cemento real', unidad:'NIU', cantidad, valor_unitario:35, precio_unitario:41.3, afectacion:'10', descuentos:[] }));
const cantidades = [{ codigo:'CEM-001', original:5, pendiente:4 }];
const qs: QueryClient[] = [];
afterEach(() => { cleanup(); qs.forEach(q => q.clear()); qs.length = 0; vi.resetAllMocks(); });
it('F001-67: 2+3 precarga 2+2, sin mutar origen y sin errores condicionales', () => {
 const items=lineasParaNota(origen)!; const antes=JSON.stringify(items);
 const r=precargarCantidadesNota(items,cantidades,'06');
 expect(r.map(l=>l.cantidad)).toEqual([2,2]); expect(limitesNota(r,cantidades,'06', ['01', '02', '06']).errores).toEqual([]); expect(JSON.stringify(items)).toBe(antes);
});
it('excluye filas agotadas y conserva el pool original para motivo 13', () => {
 const items=lineasParaNota(origen)!;
 expect(precargarCantidadesNota(items,[{...cantidades[0],pendiente:1}],'06').map(l=>l.cantidad)).toEqual([1]);
 expect(precargarCantidadesNota(items,[{...cantidades[0],pendiente:0}],'06')).toEqual([]);
 expect(precargarCantidadesNota(items,cantidades,'13').map(l=>l.cantidad)).toEqual([2,3]);
});
it('prorratea descuento e ICBPER HALF_UP y conserva precios, código y precisión', () => {
 const items=lineasParaNota([{...origen[0],precio_unitario:41.301234,icbper:1,descuentos:[{codigo:'00',monto:.01}]}])!;
 const [r]=precargarCantidadesNota(items,[{codigo:'CEM-001',original:2,pendiente:1}],'06');
 expect(r).toMatchObject({cantidad:1,valorUnitario:35,precioUnitario:41.301234,icbper:.5,descuento:{codigo:'00',monto:.01}});
 expect(items[0]).toMatchObject({cantidad:2,icbper:1});
});
it('si el descuento proporcional redondea a cero, no envía un descuento cero inválido', () => {
 const items=lineasParaNota([{...origen[1],descuentos:[{codigo:'01',monto:.01}]}])!;
 expect(precargarCantidadesNota(items,[{codigo:'CEM-001',original:3,pendiente:1}],'07')[0].descuento).toBeNull();
});
function montar(opciones: { saldo?: Promise<unknown>; detalle?: Promise<unknown> } = {}) {
 const factura=construir({tipo:'01',serie:'F001',correlativo:67,ruc:'20100070970',razonSocial:'Cliente',fecha:'2026-11-11',base:175,estado:'ACEPTADO'});
 const detalle={id:factura.id,tipo_comprobante:'01',serie:'F001',correlativo:67,numero:'F001-00000067',fecha_emision:'2026-11-11',estado:'ACEPTADO',monto_total:206.5,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente',cdr_codigo:'0',lineas_origen:origen};
 const saldo={total:206.5,devuelto:41.3,disponible:165.2,motivos_totales: ['01', '02', '06'], cantidades_pendientes:cantidades};
 vi.mocked(apiClient.get).mockImplementation(async url => ({data: String(url).endsWith('/saldo') ? await (opciones.saldo ?? Promise.resolve(saldo)) : String(url).includes(`/invoices/${factura.id}`) ? await (opciones.detalle ?? Promise.resolve(detalle)) : []}) as never);
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});qs.push(q);
 render(<QueryClientProvider client={q}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-11" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:'F001-00000067'}});
 return {q,detalle,saldo,id:factura.id};
}
it('modal precarga 2+2, con máximos coherentes desde el primer detalle',async()=>{
 montar();
 await waitFor(()=>expect(screen.getAllByLabelText(/Cantidad de la línea/)).toHaveLength(2));
 for(const input of screen.getAllByLabelText(/Cantidad de la línea/)) {expect((input as HTMLInputElement).value).toBe('2');expect((input as HTMLInputElement).max).toBe('2');expect(input.getAttribute('aria-invalid')).toBe('false');}
});
it('espera cantidades pendientes antes de precargar el detalle',async()=>{
 let resolver!: (v:unknown)=>void; const saldo=new Promise(resolve=>{resolver=resolve;});const h=montar({saldo});
 await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith(`/invoices/${h.id}/saldo`));
 expect(apiClient.get).not.toHaveBeenCalledWith(`/invoices/${h.id}`);
 resolver(h.saldo);await waitFor(()=>expect(screen.getAllByLabelText(/Cantidad de la línea/)).toHaveLength(2));
 expect((screen.getByLabelText('Cantidad de la línea 2') as HTMLInputElement).value).toBe('2');
});
it('un detalle tardío no sobrescribe una edición posterior del usuario',async()=>{
 let resolver!: (v:unknown)=>void;const detalle=new Promise(resolve=>{resolver=resolve;});const h=montar({detalle});
 await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith(`/invoices/${h.id}`));
 fireEvent.change(screen.getByLabelText('Descripción de la línea 1'),{target:{value:'Edición del usuario'}});
 await act(async()=>{resolver(h.detalle);});await waitFor(()=>expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Edición del usuario'));
 expect(screen.getAllByLabelText(/Cantidad de la línea/)).toHaveLength(1);
});
it('un refresco de saldo no vuelve a precargar ni borra cantidades ya editadas',async()=>{
 const h=montar();await waitFor(()=>expect(screen.getAllByLabelText(/Cantidad de la línea/)).toHaveLength(2));
 fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'),{target:{value:'1'}});
 await act(async()=>{await h.q.invalidateQueries({queryKey:['invoice-saldo-nota',h.id]});});
 expect((screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement).value).toBe('1');
 expect((screen.getByLabelText('Cantidad de la línea 2') as HTMLInputElement).value).toBe('2');
});
