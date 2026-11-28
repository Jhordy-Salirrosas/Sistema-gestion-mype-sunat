// Este flujo aísla los permisos; invoiceServerPermissions prueba los hooks reales y la API.
vi.mock('@/modules/invoices/hooks/useInvoiceWritePermission', async () => {
 const { useAuthStore } = await import('@/stores/authStore');
 const { serverSnapshot } = await import('../../../fixtures/permissionsServer');
 return { INVOICE_WRITE_DENIED: 'Su rol no permite emitir ni operar envíos de facturación.', useInvoiceWritePermission: () => { useAuthStore(s=>s.user); const p=serverSnapshot();return p.modules.some(m=>m.moduleCode==='M1'&&m.canWrite)&&p.actions.some(a=>a.actionCode==='INVOICE_EMIT'&&a.allowed); } };
});
vi.mock('@/modules/auth/hooks/useActionPermissions', async () => {
 const { useAuthStore }=await import('@/stores/authStore');const {serverSnapshot}=await import('../../../fixtures/permissionsServer');
 return {useActionPermissions:()=>{useAuthStore(s=>s.user);const p=serverSnapshot();return {can:(code:string)=>p.actions.some(a=>a.actionCode===code&&a.allowed),canShow:(code:string)=>p.actions.some(a=>a.actionCode===code&&a.available),ready:true,isLoading:false,isError:false};}};
});
vi.mock('@/modules/invoices/hooks/useInvoiceDatePermission', () => ({ useInvoiceDatePermission: () => ({ canEditDate: true, explanation: undefined }) }));
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { erroresCamposLinea } from '@/modules/invoices/lib/invoiceLineFields';
import { useAuthStore } from '@/stores/authStore';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
beforeEach(()=>useAuthStore.setState({user:{id:'test',email:'test@example.invalid',role:'ADMIN'}}));
afterEach(cleanup);
const callbacks={onCambiar:vi.fn(),onEliminar:vi.fn(),onAgregar:vi.fn(),onAgregarBolsa:vi.fn()};
it('muestra descripción al abandonar o editar y revisa todos los campos al añadir',()=>{
 render(<InvoiceItemsGrid items={[itemVacio('a')]} {...callbacks}/>);
 expect(screen.queryByText('La descripción es obligatoria.')).toBeNull();
 fireEvent.blur(screen.getByLabelText('Descripción de la línea 1'));
 expect(screen.getByText('La descripción es obligatoria.')).toBeTruthy();
 fireEvent.blur(screen.getByLabelText('Valor unitario de la línea 1'));

 expect(screen.getByLabelText('Valor unitario de la línea 1').getAttribute('aria-invalid')).toBe('true');
 expect(callbacks.onAgregar).not.toHaveBeenCalled();
});
it('marca valor al editar y mantiene los mensajes asociados a cada campo',()=>{
 const item={...itemVacio('a'),descripcion:'Servicio',valorUnitario:10,cantidad:0};
 const {rerender}=render(<InvoiceItemsGrid items={[item]} {...callbacks}/>);
 fireEvent.blur(screen.getByLabelText('Valor unitario de la línea 1'));
 rerender(<InvoiceItemsGrid items={[{...item,valorUnitario:0}]} {...callbacks}/>);
 expect(screen.getByText('El valor unitario de una línea onerosa debe ser mayor que cero.')).toBeTruthy();
 fireEvent.blur(screen.getByLabelText('Cantidad de la línea 1'));
 expect(screen.getByText('La cantidad debe ser entera y positiva para esta unidad.')).toBeTruthy();
 rerender(<InvoiceItemsGrid items={[{...item,cantidad:1}]} {...callbacks}/>);
 expect(screen.queryByText('La cantidad debe ser entera y positiva para esta unidad.')).toBeNull();
});
it('admite cero en notas onerosas, exige referencia gratuita y cantidad válida',()=>{
 const item={...itemVacio('a'),descripcion:'Producto'};
 expect(erroresCamposLinea(item,true).valorUnitario).toBe('');
 expect(erroresCamposLinea({...item,descripcion:'A'.repeat(501)},false).descripcion).toContain('500');
 expect(erroresCamposLinea({...item,valorUnitario:-1},true).valorUnitario).not.toBe('');
 expect(erroresCamposLinea({...item,valorUnitario:NaN},false).valorUnitario).not.toBe('');
 expect(erroresCamposLinea({...item,afectacion:'GRATUITA'},true).valorUnitario).toContain('referencial');
 expect(erroresCamposLinea({...item,cantidad:1.0001},false).cantidad).not.toBe('');
 expect(erroresCamposLinea({...item,valorUnitario:10},false)).toEqual({descripcion:'',cantidad:'',valorUnitario:''});
});
