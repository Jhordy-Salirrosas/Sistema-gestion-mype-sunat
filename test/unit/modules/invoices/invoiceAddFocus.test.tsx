import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemDesdeProducto,itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { useAuthStore } from '@/stores/authStore';
import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const producto={sku:'PRO-1',descripcion:'Producto de prueba',unidad:'NIU',valorUnitario:10,precioUnitario:11.8,afectacion:'10',stock:100};
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]}))}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[producto])}));
beforeEach(()=>useAuthStore.setState({user:{id:'test',email:'test@example.invalid',role:'ADMIN'}}));
afterEach(cleanup);
it('código y descripción son de solo lectura con explicación para sustituir producto',()=>{
 const elegido=itemDesdeProducto(producto,'b');
 render(<InvoiceItemsGrid items={[itemVacio('a'),elegido]} onCambiar={vi.fn()} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()}/>);
 expect(screen.getByLabelText('Código de la línea 1').tagName).toBe('SPAN');
 expect(screen.getByLabelText('Descripción de la línea 2').tagName).toBe('SPAN');
 expect(screen.getByLabelText('Código de la línea 2').tagName).toBe('SPAN');
 expect(screen.getByLabelText('Código de la línea 2').title).toContain('elija otro producto');
});
