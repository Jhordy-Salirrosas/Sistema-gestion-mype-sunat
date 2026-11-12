import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {InvoiceEmitCampos} from '@/modules/invoices/components/InvoiceEmitCampos';
import {borradorInicial} from '@/modules/invoices/lib/invoiceEmitDraft';
vi.mock('@/modules/invoices/components/InvoiceEmitCamposBase',()=>({CampoFecha:()=>null,CampoSelect:({id,onChange,opciones}:any)=><>{id==='motivo'&&<><button onClick={()=>onChange(opciones[0].value)}>Motivo válido</button><button onClick={()=>onChange('')}>Motivo sin seleccionar</button></>}</>}));
vi.mock('@/modules/invoices/components/CustomerLookupField',()=>({CustomerLookupField:()=>null}));
vi.mock('@/modules/invoices/components/InvoiceItemsGrid',()=>({InvoiceItemsGrid:()=>null}));
afterEach(cleanup);
it('cambiar motivo vuelve a vincular sin heredar crédito ni fecha del origen y tolera selección vacía',()=>{
 const actualizar=vi.fn();render(<InvoiceEmitCampos borrador={{...borradorInicial('07','2026-11-01'),formaPago:'Credito',cuotas:[{monto:118,vencimiento:'2026-12-01'}]}} actualizar={actualizar} existentes={[]} total={118} onItemCambiado={vi.fn()} onItemEliminado={vi.fn()} onItemAgregado={vi.fn()} onBolsaAgregada={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Motivo válido'}));expect(actualizar).toHaveBeenLastCalledWith(expect.objectContaining({motivoCodigo:'01',motivoDescripcion:'Anulación de la operación',formaPago:'Contado',cuotas:[]}));
 fireEvent.click(screen.getByRole('button',{name:'Motivo sin seleccionar'}));expect(actualizar).toHaveBeenLastCalledWith(expect.objectContaining({motivoCodigo:'',motivoDescripcion:'',formaPago:'Contado',cuotas:[]}));
});
