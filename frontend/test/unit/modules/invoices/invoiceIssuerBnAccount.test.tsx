import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceIssuerConfigForm } from '@/modules/invoices/components/InvoiceIssuerConfigForm';
afterEach(cleanup);
function mount(cuenta='') {
  const guardar=vi.fn().mockResolvedValue(undefined);
  render(<InvoiceIssuerConfigForm config={{entorno:'MOCK',cuenta_banco_nacion:cuenta} as never} ruc="20100070970" guardar={guardar}/>);
  return {guardar,input:screen.getByLabelText('Cuenta de detracciones del Banco de la Nación') as HTMLInputElement};
}
it('filtra letras al escribir y conserva ceros y maxLength 11',async()=>{
  const {input}=mount();await userEvent.type(input,'00019ABC123456');expect(input).toHaveValue('00019123456');expect(input.maxLength).toBe(11);
});
it('filtra letras al pegar y limita el resultado a 11 dígitos',async()=>{
  const {input}=mount();const user=userEvent.setup();await user.click(input);await user.paste('00019ABC123456789');expect(input).toHaveValue('00019123456');
});
it.each(['12345ABC','1234567890','123456789012'])('impide guardar el dato precargado inválido %s',async cuenta=>{
  const {input,guardar}=mount(cuenta);fireEvent.submit(input.closest('form')!);
  expect(await screen.findByText('cuenta_banco_nacion: debe contener 11 dígitos.')).toBeVisible();expect(guardar).not.toHaveBeenCalled();
});
it('guarda exactamente los 11 dígitos sin perder ceros',async()=>{
  const {input,guardar}=mount();fireEvent.change(input,{target:{value:'00019123456'}});fireEvent.submit(input.closest('form')!);
  await waitFor(()=>expect(guardar).toHaveBeenCalledWith({cuenta_banco_nacion:'00019123456'}));
});
it('permite vaciar la cuenta y conserva el contrato null para limpiar',async()=>{
  const {input,guardar}=mount('00019123456');fireEvent.change(input,{target:{value:''}});fireEvent.submit(input.closest('form')!);
  await waitFor(()=>expect(guardar).toHaveBeenCalledWith({cuenta_banco_nacion:null}));
});
