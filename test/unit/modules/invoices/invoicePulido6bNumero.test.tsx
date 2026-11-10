import { it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InvoiceNextNumber } from '@/modules/invoices/components/InvoiceNextNumber';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => ({ data: url === '/invoices/config' ? { series: [{ document_type:'01',series:'F001',current_correlative:66,is_active:true }] } : [] })) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []) } }));
afterEach(cleanup);
it('usa último+1, cambia de serie y no inventa número sin dato', () => {
 const v = render(<InvoiceNextNumber serie="F001" actual={66} />); expect(screen.getByText(/Siguiente: F001-00000067/)).toBeTruthy();
 v.rerender(<InvoiceNextNumber serie="FD01" actual={0} />); expect(screen.getByText(/FD01-00000001/)).toBeTruthy();
 v.rerender(<InvoiceNextNumber serie="FD01" />); expect(screen.getByText(/Siguiente: no disponible/)).toBeTruthy();
});
it.each(['pagina','modal'])('configuración llega al número visible en %s sin reservar ni emitir', async via => {
 const client = new QueryClient({ defaultOptions: { queries:{ retry:false,gcTime:0 } } });
 render(<QueryClientProvider client={client}><MemoryRouter>{via === 'pagina' ? <InvoiceEmissionPage /> : <InvoiceEmitModal fecha="2026-11-10" existentes={[]} tipoInicial="01" seriesConfiguradas={[{ document_type:'01',series:'F001',current_correlative:66,is_active:true }]} onEmitir={() => { throw Error('No debe emitir'); }} onCerrar={() => {}} />}</MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText(/Siguiente: F001-00000067/)).toBeTruthy(); client.clear();
});
