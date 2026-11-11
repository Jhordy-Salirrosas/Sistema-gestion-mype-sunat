import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvoiceRefresh } from '@/modules/invoices/hooks/useInvoiceRefresh';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
vi.mock('@/modules/invoices/services/invoicesApi',()=>({ invoicesApi:{ getInvoices:vi.fn() } }));
afterEach(()=>{ cleanup();vi.useRealTimers();vi.resetAllMocks(); });
function Vista(){const r=useInvoiceRefresh();return <><button onClick={()=>void r.actualizar()}>Actualizar</button><p>{r.ultimaActualizacion??'Sin actualización'}</p>{r.resultado&&<p role={r.resultado.ok?'status':'alert'}>{r.resultado.mensaje}</p>}</>;}
it('hora de Lima cambia solo en éxito y se conserva tras fallo',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-11T02:00:01Z'));
 const client=new QueryClient();render(<QueryClientProvider client={client}><Vista/></QueryClientProvider>);
 expect(screen.getByText('Sin actualización')).toBeTruthy();
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[],totalPages:1} as never);
 fireEvent.click(screen.getByRole('button'));expect(await screen.findByText('21:00:01')).toBeTruthy();
 vi.setSystemTime(new Date('2026-11-11T02:05:02Z'));vi.mocked(invoicesApi.getInvoices).mockRejectedValue(new Error('red'));
 fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(screen.getByText('21:00:01')).toBeTruthy();expect(screen.queryByText('21:05:02')).toBeNull();
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[],totalPages:1} as never);fireEvent.click(screen.getByRole('button'));
 expect(await screen.findByText('21:05:02')).toBeTruthy();client.clear();
});
