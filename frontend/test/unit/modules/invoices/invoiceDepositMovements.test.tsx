import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  expect(screen.getByText(/Constancia 001/)).toBeTruthy();
  const amount=screen.getByLabelText('Monto');expect(amount).toHaveValue('68.00');
  fireEvent.change(screen.getByLabelText('Fecha'),{target:{value:'2026-11-03'}});
  fireEvent.change(screen.getByLabelText('Constancia'),{target:{value:'002'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar depósito'}));
  await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith('/invoices/detractions/i',{amount:68,date:'2026-11-03',constancia:'002'}));
  expect(mocks.put).not.toHaveBeenCalled();
 });
 it('edita únicamente el movimiento elegido y permite una constancia vacía',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Editar depósito 001'}));
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
  expect(screen.getByRole('button',{name:'Editar depósito 001'})).toBeEnabled();
 });
});
