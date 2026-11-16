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
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceFiltersBar } from '@/modules/invoices/components/InvoiceFiltersBar';

describe('selector de fechas', () => {
  it('comunica la fecha elegida en el control nativo', () => {
    const onChange = vi.fn();
    render(<InvoiceFiltersBar filtros={{ busqueda: '', estado: 'TODOS', desde: '', hasta: '' }} onFiltrosChange={onChange} onActualizar={() => {}} onEmitir={() => {}} />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-15' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ desde: '2026-10-15' }));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-16' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hasta: '2026-10-16' }));
    cleanup();
  });
});
