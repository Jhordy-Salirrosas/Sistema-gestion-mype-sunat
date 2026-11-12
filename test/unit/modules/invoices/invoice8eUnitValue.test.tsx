import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {useState} from 'react';
import {InvoiceItemsGrid} from '@/modules/invoices/components/InvoiceItemsGrid';
import {actualizarItem,calcularItem,itemDesdeProducto} from '@/modules/invoices/lib/invoiceItems';
import {lineasParaNota} from '@/modules/invoices/lib/invoiceLineasOrigen';
import {borradorInicial} from '@/modules/invoices/lib/invoiceEmitDraft';
import {borradorAPayloadEmision} from '@/modules/invoices/lib/invoiceEmitPayload';
const product=(aff='10')=>itemDesdeProducto({sku:'CEM-001',descripcion:'Cemento',unidad:'NIU',valorUnitario:100,precioUnitario:aff==='10'?118:100,afectacion:aff},'p');
afterEach(cleanup);
it.each(['catálogo','nota'])('edición real de %s actualiza base, precio, total y payload',origen=>{
 const initial=origen==='catálogo'?product():lineasParaNota([{codigo:'CEM-001',descripcion:'Cemento',unidad:'NIU',cantidad:1,afectacion:'10',valor_unitario:100,precio_unitario:118}] as never)![0];
 function Form(){const[items,set]=useState([initial]);const b={...borradorInicial('01','2026-11-11'),items};return <><InvoiceItemsGrid items={items} onCambiar={(i,p)=>set(v=>actualizarItem(v,i,p) as typeof v)} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()} onEliminar={vi.fn()} esNota={origen==='nota'}/><output aria-label="Total">{calcularItem(items[0]).total}</output><output aria-label="Precio enviado">{borradorAPayloadEmision(b).items[0].precioUnitario}</output></>;}
 render(<Form/>);expect((screen.getByLabelText('Valor unitario de la línea 1') as HTMLInputElement).value).toBe('100.00');fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'),{target:{value:'150'}});expect(screen.getByLabelText('Total').textContent).toBe('177');expect(screen.getByLabelText('Precio enviado').textContent).toBe('177');
});
it.each(['20','30'])('naturaleza %s conserva precio igual a base',aff=>{const item=actualizarItem([product(aff)],0,{valorUnitario:150})[0];expect(item.precioUnitario).toBe(150);expect(calcularItem(item).total).toBe(150);});
it('referencia gratuita editable mantiene el precio cero e ICBPER',()=>{const item={...product(),afectacion:'GRATUITA' as const,codigoAfectacion:'11',precioUnitario:0,icbper:1};const updated=actualizarItem([item],0,{valorUnitario:150})[0];expect(updated).toMatchObject({valorUnitario:150,precioUnitario:0});expect(calcularItem(updated).total).toBe(1);});
it('conserva precisión unitaria y la edición inversa de precio',()=>{const item=actualizarItem([product()],0,{valorUnitario:0.335})[0];expect(item.precioUnitario).toBe(0.3953);expect(actualizarItem([item],0,{precioUnitario:118})[0]).toMatchObject({valorUnitario:100,precioUnitario:118});});
