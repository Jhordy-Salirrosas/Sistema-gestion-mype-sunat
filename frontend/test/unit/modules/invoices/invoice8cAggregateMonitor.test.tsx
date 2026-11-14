import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InvoiceAggregateMonitor } from '@/modules/invoices/components/InvoiceAggregateMonitor';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getAgregados:vi.fn(),consultarAgregado:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('C5 informa contador agotado y mantiene consulta manual; C4 no oculta aceptación RA',async()=>{
 vi.mocked(invoicesApi.getAgregados).mockResolvedValue([{id:'p',kind:'RA',identifier:'RA-1',reference_date:'2026-11-11',state:'POLLING',ticket:'T',transport_uncertain:true,error:null,result:null,polling:{attempts:24,nextAt:null,exhausted:true,historyUnknown:false,inProgress:false}},
 {id:'a',kind:'RA',identifier:'RA-2',reference_date:'2026-11-11',state:'ACCEPTED',ticket:'T2',transport_uncertain:false,error:null,result:{codigo:'0'},bridge_reversal:{pending:1,done:0}}]);
 render(<InvoiceAggregateMonitor/>);
 expect(await screen.findByText(/Sondeos automáticos: 24\/24/)).toBeTruthy();
 expect(screen.getByRole('button',{name:'Consultar ticket RA-1'})).toBeTruthy();
 expect(screen.getByText(/Transporte incierto/)).toBeTruthy();
 expect(screen.getByText(/ANULADO con reversión pendiente/)).toBeTruthy();
 expect(screen.getByText(/RA-2 · ACCEPTED/)).toBeTruthy();
});
it('C5 muestra consulta en curso y falta de historial sin inventar un contador reiniciado',async()=>{
 vi.mocked(invoicesApi.getAgregados).mockResolvedValue([{id:'p',kind:'RC',identifier:'RC-1',reference_date:'2026-11-11',state:'POLLING',ticket:'T',transport_uncertain:false,error:null,result:null,polling:{attempts:8,nextAt:null,exhausted:false,historyUnknown:true,inProgress:false}}]);
 render(<InvoiceAggregateMonitor/>);expect(await screen.findByText(/no se pudo recuperar el contador/)).toBeTruthy();
});
it('confirma última lectura de agregados y no adelanta la hora ante un error', async () => {
 vi.useFakeTimers({toFake:['Date']});
 try {
  vi.setSystemTime(new Date('2026-11-14T15:00:00Z'));
  vi.mocked(invoicesApi.getAgregados).mockResolvedValue([]);
  render(<InvoiceAggregateMonitor/>);
  const marca=await screen.findByLabelText('Última actualización de agregados');
  expect(marca.textContent).toBe('10:00:00');
  vi.setSystemTime(new Date('2026-11-14T15:01:00Z'));
  fireEvent.click(screen.getByRole('button',{name:'Actualizar agregados'}));
  await waitFor(()=>expect(marca.getAttribute('datetime')).toBe('2026-11-14T15:01:00.000Z'));
  vi.mocked(invoicesApi.getAgregados).mockRejectedValueOnce(new Error('Agregados no disponibles'));
  vi.setSystemTime(new Date('2026-11-14T15:02:00Z'));
  fireEvent.click(screen.getByRole('button',{name:'Actualizar agregados'}));
  await screen.findByText('Agregados no disponibles');
  expect(marca.getAttribute('datetime')).toBe('2026-11-14T15:01:00.000Z');
 } finally {vi.useRealTimers();}
});
it('una carga inicial fallida no se presenta como actualización completada', async () => {
 vi.mocked(invoicesApi.getAgregados).mockRejectedValueOnce(new Error('Sin lectura'));
 render(<InvoiceAggregateMonitor/>);await screen.findByText('Sin lectura');
 expect(screen.queryByLabelText('Última actualización de agregados')).toBeNull();
});
