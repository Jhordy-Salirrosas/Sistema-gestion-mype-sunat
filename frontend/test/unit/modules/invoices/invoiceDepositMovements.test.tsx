import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvoiceDetractionsPage from '@/modules/invoices/pages/InvoiceDetractionsPage';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn()}));
vi.mock('@/lib/axios',()=>({apiClient:mocks}));
const row={id:'i',numero:'F001-00000001',date:'2026-11-01',customer:'Cliente',total:1180,detraction:118,depositedAt:'2026-11-02',depositedAmount:50,depositedTotal:50,balance:68,deposits:[{id:'m1',date:'2026-11-02',amount:50,constancia:'001'}]};
let qc: QueryClient;
beforeEach(()=>{vi.resetAllMocks();mocks.get.mockResolvedValue({data:[row]});mocks.post.mockResolvedValue({data:{}});mocks.put.mockResolvedValue({data:{}});qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});});
afterEach(()=>{cleanup();qc.clear();});
function mount(){render(<QueryClientProvider client={qc}><InvoiceDetractionsPage/></QueryClientProvider>);}
describe('movimientos de detracción',()=>{
 it('muestra movimientos, acumulado y saldo; agrega un complemento con nueva constancia',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Agregar depósito'}));
  expect(screen.getByText(/Constancia N.º 001/)).toBeTruthy();
  const amount=screen.getByLabelText('Monto');expect(amount).toHaveValue('68.00');
  fireEvent.change(screen.getByLabelText('Fecha'),{target:{value:'2026-11-03'}});
  fireEvent.change(screen.getByLabelText('Constancia'),{target:{value:'002'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar depósito'}));
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith('/invoices/detractions/i',{amount:68,date:'2026-11-03',constancia:'002'}));
  expect(mocks.put).not.toHaveBeenCalled();
 });
 it('edita únicamente el movimiento elegido y permite una constancia vacía',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Editar depósitos de F001-00000001'}));
  const amount=screen.getByLabelText('Monto');fireEvent.focus(amount);fireEvent.change(amount,{target:{value:'40'}});
  fireEvent.change(screen.getByLabelText('Constancia'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar depósito'}));
  await waitFor(()=>expect(mocks.put).toHaveBeenCalledWith('/invoices/detractions/i/deposits/m1',{amount:40,date:'2026-11-02',constancia:''}));
  expect(mocks.post).not.toHaveBeenCalled();
 });
 it('bloquea monto sobre el saldo y constancia no numérica con mensajes visibles',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Agregar depósito'}));
  const amount=screen.getByLabelText('Monto');fireEvent.focus(amount);fireEvent.change(amount,{target:{value:'69'}});
  fireEvent.change(screen.getByLabelText('Constancia'),{target:{value:'ABC'}});
  expect(screen.getByText(/no superar 68.00/)).toBeTruthy();
  expect(screen.getByText('La constancia debe contener solo dígitos o quedar vacía.')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Guardar depósito'})).toBeDisabled();expect(mocks.post).not.toHaveBeenCalled();
 });
 it('conserva el formulario y muestra el error del servidor si cambió el saldo',async()=>{
  mocks.post.mockRejectedValue({response:{data:{message:'El total depositado no puede superar la detracción.'}}});
  mount();fireEvent.click(await screen.findByRole('button',{name:'Agregar depósito'}));fireEvent.click(screen.getByRole('button',{name:'Guardar depósito'}));
  await waitFor(()=>expect(screen.getAllByText('El total depositado no puede superar la detracción.')).toHaveLength(2));
  expect(screen.getByRole('dialog')).toBeTruthy();
 });
 it('depósito completo impide nuevas altas pero permite editar el movimiento',async()=>{
  mocks.get.mockResolvedValue({data:[{...row,depositedTotal:118,balance:0}]});
  mount();expect(await screen.findByRole('button',{name:'Agregar depósito'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Editar depósitos de F001-00000001'})).toBeEnabled();
 });
 it('presenta las diez columnas, un único Editar por comprobante y los totales del período visible',async()=>{
  const amounts=[73.02,73.02,73.02,0];
  mocks.get.mockResolvedValue({data:amounts.map((amount,i)=>({...row,id:`i${i}`,numero:`F001-${i}`,total:730.17,detraction:73.02,depositedTotal:amount,balance:73.02-amount,depositedAt:amount?'2026-11-14':null,deposits:i===2?[{id:'a',date:'2026-11-14',amount:33.02,constancia:'00123457'},{id:'b',date:'2026-11-14',amount:40,constancia:'00123458'}]:amount?[{id:`m${i}`,date:'2026-11-14',amount,constancia:'001'}]:[]}))});
  mount();await screen.findByRole('button',{name:'Registrar'});
  const table=screen.getByRole('table');
  expect(within(table).getAllByRole('columnheader').map(c=>c.textContent)).toEqual(['Comprobante','Fecha','Cliente','Total','Detracción','Depósitos','Editar','Total depositado','Saldo','Acción']);
  const summary=screen.getByRole('group',{name:'Resumen del período'});
  expect(summary).toHaveTextContent('4 comprobantes');
  expect(summary).toHaveTextContent('Detracción total S/ 292.08');
  expect(summary).toHaveTextContent('Depositado S/ 219.06');
  expect(summary).toHaveTextContent('Saldo pendiente S/ 73.02');
  const rows=within(table).getAllByRole('row').slice(1);
  rows.forEach((r,i)=>{
    const buttons=within(r).queryAllByRole('button',{name:/Editar/});
    expect(buttons).toHaveLength(i<3?1:0);
    if(buttons.length)expect(buttons[0].closest('td')).toBe(r.querySelectorAll('td')[6]);
  });
  expect(rows[0].querySelectorAll('td')[3]).toHaveTextContent('S/ 730.17');
  expect(rows[0].querySelectorAll('td')[4]).toHaveTextContent('S/ 73.02');
  expect(rows[2].querySelectorAll('td')[5].querySelectorAll('li')).toHaveLength(2);
  expect(rows[3].querySelectorAll('td')[8]).toHaveTextContent('S/ 73.02');
  expect(screen.getByText('Sin depósitos')).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Ver comprobantes'})).toBeNull();
 });
 it.each(['00123457','00123458'])('permite elegir y editar el depósito %s sin cambiar el flujo de guardado',async(constancia)=>{
  mocks.get.mockResolvedValue({data:[{...row,deposits:[{id:'a',date:'2026-11-02',amount:30,constancia:'00123457'},{id:'b',date:'2026-11-03',amount:20,constancia:'00123458'}]}]});
  mount();fireEvent.click(await screen.findByRole('button',{name:'Editar depósitos de F001-00000001'}));
  expect(screen.getByRole('dialog')).toHaveTextContent('Seleccionar depósito para editar');
  expect(mocks.put).not.toHaveBeenCalled();expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:`Editar depósito ${constancia}`}));
  const first=constancia==='00123457';
  expect(screen.getByRole('dialog')).toHaveTextContent('Editar depósito de detracción');
  expect(screen.getByLabelText('Monto')).toHaveValue(first?'30.00':'20.00');
  expect(screen.getByLabelText('Constancia')).toHaveValue(constancia);
  fireEvent.click(screen.getByRole('button',{name:'Guardar depósito'}));
  await waitFor(()=>expect(mocks.put).toHaveBeenCalledWith(`/invoices/detractions/i/deposits/${first?'a':'b'}`,{amount:first?30:20,date:first?'2026-11-02':'2026-11-03',constancia}));
  expect(mocks.post).not.toHaveBeenCalled();
 });
 it('actualiza el resumen y conserva la consulta de período al cambiar el mes',async()=>{
  const month=new Date().getMonth()===9?'09':'10';
  mocks.get.mockImplementation(async(_url,{params})=>({data:params.period.endsWith(`-${month}`)?[]:[row]}));
  mount();await screen.findByRole('button',{name:'Agregar depósito'});
  fireEvent.change(screen.getByLabelText('Año contable'),{target:{value:'2026'}});
  fireEvent.change(screen.getByLabelText('Mes contable'),{target:{value:month}});
  await waitFor(()=>expect(screen.getByRole('group',{name:'Resumen del período'})).toHaveTextContent('0 comprobantes'));
  expect(screen.getByRole('group',{name:'Resumen del período'})).toHaveTextContent('Saldo pendiente S/ 0.00');
  expect(mocks.get).toHaveBeenCalledWith('/invoices/detractions',{params:{period:`2026-${month}`}});
  expect(screen.getByRole('heading',{name:new RegExp(`Comprobantes.*${month==='09'?'septiembre':'octubre'} 2026`)})).toBeTruthy();
 });

});
