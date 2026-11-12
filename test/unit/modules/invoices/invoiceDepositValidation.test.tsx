import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceDetractionsPage from '@/modules/invoices/pages/InvoiceDetractionsPage';
import { errorMontoDeposito } from '@/modules/invoices/lib/invoiceDepositValidation';
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn().mockResolvedValue({data:[{id:'i1', numero:'F001-00000001',date:'2026-11-12',customer:'Cliente',total:1180,detraction:118}]}) }));
vi.mock('@/lib/axios', () => ({apiClient:mocks}));
describe('monto del depósito', () => {
 it.each([-1,0,1.001,118.01,NaN,Infinity])('rechaza %s', amount => expect(errorMontoDeposito(amount,118)).toBeTruthy());
 it.each([0.01,1.23,118])('admite %s', amount => expect(errorMontoDeposito(amount,118)).toBeUndefined());
 it('edita dinero, muestra el tope y bloquea guardar sin reemplazar vacío por el total', async () => {
  const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={qc}><InvoiceDetractionsPage/></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Registrar'}));
  const amount=screen.getByLabelText('Monto');
  fireEvent.focus(amount); fireEvent.change(amount,{target:{value:'119'}});
  expect(screen.getByRole('alert').textContent).toContain('118.00');
  expect(screen.getByRole('button',{name:'Guardar depósito'})).toBeDisabled();
  fireEvent.change(amount,{target:{value:''}});
  expect(screen.getByRole('button',{name:'Guardar depósito'})).toBeDisabled();
  fireEvent.change(amount,{target:{value:'1.23'}});
  expect(screen.getByRole('button',{name:'Guardar depósito'})).toBeEnabled();
  fireEvent.change(amount,{target:{value:'1.234'}});
  expect(amount).toHaveValue('1.23');
  expect(mocks.post).not.toHaveBeenCalled(); qc.clear();
 });
});
