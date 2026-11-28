import { lineasParaNota } from '@/modules/invoices/lib/invoiceLineasOrigen';
import { limitesNota,precargarCantidadesNota } from '@/modules/invoices/lib/invoiceNoteQuantities';
import { QueryClient } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'SERV',descripcion:'Servicio elegido',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}])}));
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
