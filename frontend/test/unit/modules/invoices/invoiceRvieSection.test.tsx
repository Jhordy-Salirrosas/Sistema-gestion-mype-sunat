import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { InvoiceRvieSection } from '@/modules/invoices/components/InvoiceRvieSection';
import { cargarPaginasMonitor } from '@/modules/invoices/lib/invoiceMonitorData';
import type { Invoice } from '@/modules/invoices/types/invoice.types';
vi.mock('@/modules/invoices/lib/invoiceMonitorData',()=>({cargarPaginasMonitor:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('la propuesta vacía deshabilita la exportación',async()=>{
 vi.mocked(cargarPaginasMonitor).mockResolvedValue([]);
 render(<InvoiceRvieSection/>);
 expect((await screen.findByRole('button',{name:'Exportar propuesta RVIE - SIRE (CSV)'})).hasAttribute('disabled')).toBe(true);
});
it.each([false,true])('desmontar no publica el resultado tardío, rechazo=%s',async rechazo=>{
 let resolve!:(docs:Invoice[])=>void,reject!:(error:unknown)=>void;
 vi.mocked(cargarPaginasMonitor).mockReturnValue(new Promise<Invoice[]>((ok,fail)=>{resolve=ok;reject=fail;}));
 const view=render(<InvoiceRvieSection/>);view.unmount();
 await act(async()=>{if(rechazo)reject(new Error('Fallo tardío'));else resolve([]);});
 expect(screen.queryByRole('region',{name:'Propuesta RVIE'})).toBeNull();
});
