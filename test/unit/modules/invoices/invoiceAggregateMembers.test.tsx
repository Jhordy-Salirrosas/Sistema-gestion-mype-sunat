import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {InvoiceAggregateMonitor} from '@/modules/invoices/components/InvoiceAggregateMonitor';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
import {aInvoice} from '@/modules/invoices/lib/invoiceMapper';
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getAgregados:vi.fn(),consultarAgregado:vi.fn(),getInvoiceById:vi.fn(),descargarDocumento:vi.fn(async()=>{throw Error('XML ausente')})}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const member={id:'i1',numero:'B001-00000014',tipo:'03',monto:118,estado:'ACEPTADO'};
const agregado=(kind:'RA'|'RC')=>({id:'a1',kind,identifier:`${kind}-1`,reference_date:'2026-11-12',state:'ACCEPTED',ticket:'T1',transport_uncertain:false,error:null,result:{codigo:'0'},members:[member]});
it.each(['RA','RC'] as const)('%s muestra miembros y abre el detalle real por id',async kind=>{
 vi.mocked(invoicesApi.getAgregados).mockResolvedValue([agregado(kind)]);
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(aInvoice({id:'i1',numero:'B001-00000014',tipo_comprobante:'03',serie:'B001',correlativo:14,fecha_emision:'2026-11-12',estado:'ACEPTADO',monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente real',cdr_codigo:'0'}));
 render(<InvoiceAggregateMonitor/>);
 const card=await screen.findByLabelText(`Comprobantes de ${kind}-1`);
 expect(within(card).getByText(/B001-00000014 · tipo 03 · monto 118.00 · ACEPTADO/)).toBeTruthy();
 fireEvent.click(within(card).getByRole('button',{name:'Ver comprobante B001-00000014'}));
 const dialog=await screen.findByRole('dialog');expect(dialog.textContent).toContain('B001-00000014');expect(dialog.textContent).toContain('Cliente real');
 expect(invoicesApi.getInvoiceById).toHaveBeenCalledWith('i1');
});
it('muestra el error si el miembro no se puede consultar y no fabrica detalle',async()=>{
 vi.mocked(invoicesApi.getAgregados).mockResolvedValue([agregado('RC')]);vi.mocked(invoicesApi.getInvoiceById).mockRejectedValue(new Error('Comprobante no disponible'));
 render(<InvoiceAggregateMonitor/>);fireEvent.click(await screen.findByRole('button',{name:'Ver comprobante B001-00000014'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Comprobante no disponible'));expect(screen.queryByRole('dialog')).toBeNull();
});
