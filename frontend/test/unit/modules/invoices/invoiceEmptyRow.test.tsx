import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {agregarFilaModal} from '@/modules/invoices/lib/invoiceEmptyRow';
import {itemVacio} from '@/modules/invoices/lib/invoiceItems';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import {seriesConfiguradasPrueba} from '../../../fixtures/invoiceSeries';
import {useAuthStore} from '@/stores/authStore';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
beforeEach(()=>{useAuthStore.setState({user:{id:'test',email:'test@example.invalid',role:'ADMIN'}});});
afterEach(()=>cleanup());
it('primera vacía se reutiliza sin crear claves ni perder datos',()=>{
 const items=[{...itemVacio('a'),codigo:'  ',descripcion:' ',cantidad:2},itemVacio('b')];const create=vi.fn(()=>itemVacio('c'));
 expect(agregarFilaModal(items,create)).toBe(items);expect(create).not.toHaveBeenCalled();
});
it.each([{codigo:'SKU',descripcion:''},{codigo:'',descripcion:'Producto'},null])('añade cuando la primera está ocupada o no existe: %j',line=>{
 const items=line?[{...itemVacio('a'),...line}]:[];const create=vi.fn(()=>itemVacio('nueva'));
 expect(agregarFilaModal(items,create)).toEqual([...items,itemVacio('nueva')]);expect(create).toHaveBeenCalledTimes(1);
});
it.each(['07','08'] as const)('botón real en nota %s reutiliza vacía y luego agrega sin reemplazar texto editado',tipo=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial={tipo} fecha="2026-11-13" existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole('button',{name:'+ Añadir ítem'}));expect(screen.queryByLabelText('Descripción de la línea 2')).toBeNull();
 fireEvent.change(screen.getByLabelText('Descripción de la línea 1'),{target:{value:'Producto editado'}});
 fireEvent.click(screen.getByRole('button',{name:'+ Añadir ítem'}));expect(screen.getByLabelText('Descripción de la línea 2')).toBeTruthy();expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Producto editado');client.clear();
});
