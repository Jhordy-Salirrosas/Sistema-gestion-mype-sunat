import { it,expect,vi,afterEach } from 'vitest';
import { render,screen,cleanup,fireEvent } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
afterEach(cleanup);
it('cierre del diálogo M1 es Cerrar sin modificar el componente compartido',()=>{
 const cerrar=vi.fn(),c=new QueryClient();render(<QueryClientProvider client={c}><InvoiceEmitModal tipoInicial="07" fecha="2026-11-10" existentes={[]} onCerrar={cerrar} onEmitir={()=>{}}/></QueryClientProvider>);
 expect(screen.queryByRole('button',{name:'Close'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));expect(cerrar).toHaveBeenCalledTimes(1);c.clear();
});
it('solo traduce etiqueta, el valor sigue MOCK',()=>{
 render(<InvoiceIssuerConfigForm config={{entorno:'MOCK'} as never} ruc="20000000001" guardar={vi.fn()}/>);
 expect((screen.getByLabelText('Ambiente') as HTMLSelectElement).value).toBe('MOCK');expect(screen.getByRole('option',{name:'SIMULADO (pruebas)'})).toBeTruthy();
});
