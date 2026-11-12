import '@testing-library/jest-dom/vitest';
import { describe,it,expect,vi } from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PartnerFormDialog} from '@/modules/customs/components/PartnerFormDialog';
import {errorDatosTercero,documentoTerceroValido} from '@/modules/customs/libPartnerValidation';
const valid={docType:'6',docNumber:'20100070970',legalName:'Cliente',tradeName:'',countryCode:'PE',email:''};
describe('maestro: validación compartida',()=>{
 it.each([['1','12345678'],['6','20100070970'],['4','CE-123'],['0','US-ABC']])('preserva %s %s',(t,n)=>expect(documentoTerceroValido(t,n)).toBe(true));
 it.each([['1','1234567'],['1','1234567A'],['6','20100070971'],['0',''],['4','']])('rechaza %s %s',(t,n)=>expect(documentoTerceroValido(t,n)).toBe(false));
 it.each([{legalName:' '},{legalName:'x'.repeat(201)},{tradeName:' '},{tradeName:'x'.repeat(201)},{countryCode:'PER'},{email:'incorrecto'}])('valida %j',patch=>expect(errorDatosTercero({...valid,...patch})).toBeTruthy());
 it('bloquea guardar y muestra error por tipo en el diálogo real',()=>{
  const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={qc}><PartnerFormDialog onClose={vi.fn()} initialDocument="12345678" initialName="Cliente"/></QueryClientProvider>);
  expect(screen.getByRole('button',{name:'Guardar tercero'})).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Número'),{target:{value:'1234567'}});
  expect(screen.getByRole('alert')).toHaveTextContent('DNI de 8 dígitos');
  expect(screen.getByRole('button',{name:'Guardar tercero'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Tipo de documento'),{target:{value:'4'}});
  fireEvent.change(screen.getByLabelText('Número'),{target:{value:'CE-123'}});
  expect(screen.getByRole('button',{name:'Guardar tercero'})).toBeEnabled();qc.clear();
 });
});
