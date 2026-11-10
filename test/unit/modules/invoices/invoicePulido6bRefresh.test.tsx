import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useInvoiceRefresh } from '@/modules/invoices/hooks/useInvoiceRefresh';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoices: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const pagina = (n: number) => ({ data: Array.from({ length: n }, () => ({ estadoBackend: 'ACEPTADO' })), total: n, totalPages: 1, page: 1, pageSize: 100 });
function Vista() {
 const q = useQuery({ queryKey: ['invoices',1], queryFn: async () => pagina(1), staleTime: Infinity });
 const r = useInvoiceRefresh();
 return <><button disabled={r.actualizando} onClick={() => { void r.actualizar(); }}>{r.actualizando ? 'Actualizando…' : 'Actualizar'}</button><span>Contador: {q.data?.data.length}</span>{r.resultado && <p role={r.resultado.ok ? 'status' : 'alert'}>{r.resultado.mensaje}</p>}</>;
}
it('clic pide red, actualiza lista/contador e invalida métricas; evita doble clic', async () => {
 const c = new QueryClient(); c.setQueryData(['invoices',1], pagina(1));
 const invalidar = vi.spyOn(c, 'invalidateQueries');
 let resolver!: (v: never) => void;
 vi.mocked(invoicesApi.getInvoices).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
 render(<QueryClientProvider client={c}><Vista /></QueryClientProvider>);
 const button = screen.getByRole('button'); fireEvent.click(button); fireEvent.click(button);
 await waitFor(() => expect(invoicesApi.getInvoices).toHaveBeenCalledTimes(1));
 expect(invoicesApi.getInvoices).toHaveBeenCalledWith(1,{ page_size:100 },true);
 expect(button.textContent).toBe('Actualizando…'); resolver(pagina(2) as never);
 await screen.findByText('Contador: 2'); await screen.findByRole('status');
 expect(invalidar).toHaveBeenCalledWith({ queryKey:['invoices-dashboard-metrics'] });
 expect(invalidar).toHaveBeenCalledWith({ queryKey:['invoices','metrics'] }); c.clear();
});
it('fallo de red conserva datos pero informa que no se actualizaron', async () => {
 const c = new QueryClient(); c.setQueryData(['invoices',1], pagina(1));
 vi.mocked(invoicesApi.getInvoices).mockRejectedValue(new Error('red'));
 render(<QueryClientProvider client={c}><Vista /></QueryClientProvider>); fireEvent.click(screen.getByRole('button'));
 expect((await screen.findByRole('alert')).textContent).toContain('datos anteriores'); expect(screen.getByText('Contador: 1')).toBeTruthy(); c.clear();
});
