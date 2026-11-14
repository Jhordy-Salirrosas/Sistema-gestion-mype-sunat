import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {useState} from 'react';
import {InvoiceItemsGrid} from '@/modules/invoices/components/InvoiceItemsGrid';
import {actualizarItem,itemDesdeProducto,validarItems,calcularItem} from '@/modules/invoices/lib/invoiceItems';
const product=()=>itemDesdeProducto({sku:'SERV',descripcion:'Bien',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10'},'k');
afterEach(cleanup);
it('selección explícita de gratuita conserva referencia y cero cobrado; restaura el precio oneroso',()=>{
 function Form(){const [items,set]=useState([product()]);return <><InvoiceItemsGrid items={items} onCambiar={(i,p)=>set(v=>actualizarItem(v,i,p) as typeof v)} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()}/><output>{JSON.stringify(items[0])}</output></>;}
 render(<Form/>);expect(screen.queryByRole('combobox',{name:'Afectación de la línea 1'})).toBeNull();expect(screen.getByLabelText('Afectación de la línea 1').textContent).toContain('1000 - IGV');fireEvent.click(screen.getByLabelText('Gratuita de la línea 1'));const reason=screen.getByLabelText('Motivo de gratuidad de la línea 1');expect((reason as HTMLSelectElement).disabled).toBe(false);fireEvent.change(reason,{target:{value:'21'}});expect(screen.getByText(/"precioUnitario":0/).textContent).toContain('"valorUnitario":100');expect(screen.getByText(/"codigoAfectacion":"21"/)).toBeTruthy();fireEvent.click(screen.getByLabelText('Gratuita de la línea 1'));expect(screen.getByText(/"precioUnitario":118/)).toBeTruthy();
});
it('falta de motivo o referencia bloquea; ICBPER no excusa referencia cero',()=>{
 const i={...product(),afectacion:'GRATUITA' as const,precioUnitario:0,codigoAfectacion:''};expect(validarItems([i])).toHaveLength(1);expect(validarItems([{...i,codigoAfectacion:'21'}])).toHaveLength(0);expect(validarItems([{...i,codigoAfectacion:'21',valorUnitario:0,icbper:1}])).toHaveLength(1);expect(calcularItem({...i,codigoAfectacion:'11',icbper:1}).total).toBe(1);
});
it('editar referencia no se transforma en precio cobrado ni pierde precisión',()=>{const i={...product(),afectacion:'GRATUITA' as const,precioUnitario:0,codigoAfectacion:'11'};expect(actualizarItem([i],0,{valorUnitario:123.45})[0]).toMatchObject({valorUnitario:123.45,precioUnitario:0});});

it('payload conserva el código explícito, referencia positiva y precio cero',()=>{const draft=borradorInicial('01','2026-11-12');draft.items=[{...product(),afectacion:'GRATUITA',codigoAfectacion:'21',precioUnitario:0}];expect(borradorAPayloadEmision(draft).items[0]).toMatchObject({afectacion:'21',valorUnitario:100,precioUnitario:0});});

it.each([['10','1000 - IGV'],['20','9997 - Exonerado'],['30','9998 - Inafecto'],['40','9995 - Exportación']])('afectación %s conserva código y tributo sin selector', (codigo, tributo) => {
 const item=itemDesdeProducto({sku:'P',descripcion:'Producto',unidad:'NIU',valorUnitario:100,afectacion:codigo},'p');
 render(<InvoiceItemsGrid items={[item]} onCambiar={vi.fn()} onEliminar={vi.fn()}/>);
 expect(screen.queryByRole('combobox',{name:'Afectación de la línea 1'})).toBeNull();
 expect(screen.getByLabelText('Afectación de la línea 1').textContent).toContain(codigo);
 expect(screen.getByLabelText('Afectación de la línea 1').textContent).toContain(tributo);
});
