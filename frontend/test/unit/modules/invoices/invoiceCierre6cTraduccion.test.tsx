import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
afterEach(cleanup);
it('solo traduce etiqueta, el valor sigue MOCK',()=>{
 render(<InvoiceIssuerConfigForm config={{entorno:'MOCK'} as never} ruc="20000000001" guardar={vi.fn()}/>);
 expect((screen.getByLabelText('Ambiente') as HTMLSelectElement).value).toBe('MOCK');expect(screen.getByRole('option',{name:'SIMULADO (pruebas)'})).toBeTruthy();
});
