import { it,expect,vi,afterEach } from 'vitest';
import { render,screen,fireEvent,cleanup } from '@testing-library/react';
import Precios from '@/modules/invoices/pages/InvoicePricesPage';
import { listarPrecios,guardarPrecio } from '@/modules/invoices/services/inventoryProductsApi';
import { numeroVisible } from '@/modules/invoices/lib/invoiceVisibleNumber';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({listarPrecios:vi.fn(),guardarPrecio:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('precio recibido se muestra con dos decimales; solo Guardar escribe el visible',async()=>{
 vi.mocked(listarPrecios).mockResolvedValue([{sku:'ARE',description:'Arena',salePrice:81.12999725341797}] as never);vi.mocked(guardarPrecio).mockResolvedValue(undefined);
 render(<Precios/>);const input=await screen.findByLabelText('Precio de ARE');expect((input as HTMLInputElement).value).toBe('81.13');expect(guardarPrecio).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await screen.findByText('Precio guardado: ARE');expect(guardarPrecio).toHaveBeenCalledWith('ARE',81.13);
 fireEvent.change(input,{target:{value:'81.123'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));await screen.findByText(/máximo de dos decimales/);expect(guardarPrecio).toHaveBeenCalledTimes(1);
});
it.each([['F001',66,'F001-00000066'],['FC01',13,'FC01-00000013']] as const)('fila y etiqueta accesible de %s usan ocho dígitos', (serie,correlativo,esperado)=>{
 const c=construir({tipo:serie==='FC01'?'07':'01',serie,correlativo,ruc:'20100070970',razonSocial:'Cliente',fecha:'2026-11-10',base:100,estado:'ACEPTADO'});
 render(<InvoiceTable comprobantes={[c]} onVerXml={()=>{}} onVerCdr={()=>{}} onDescargarPdf={()=>{}} onReintentarCdr={()=>{}}/>);
 expect(numeroVisible(serie,correlativo)).toBe(esperado);expect(screen.getByText(esperado)).toBeTruthy();expect(screen.getByLabelText(`Ver detalle XML de ${esperado}`)).toBeTruthy();expect(c.correlativo).toBe(correlativo);
});
