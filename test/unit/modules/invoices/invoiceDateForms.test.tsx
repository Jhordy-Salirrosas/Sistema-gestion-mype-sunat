import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {PeriodInput} from '@/components/common/PeriodInput';
import {InvoiceFiltersBar} from '@/modules/invoices/components/InvoiceFiltersBar';
import SalesReportPage from '@/modules/invoices/pages/SalesReportPage';
import {errorRangoFechas} from '@/modules/invoices/lib/invoiceDateRange';
const mocks=vi.hoisted(()=>({get:vi.fn().mockResolvedValue({data:null})}));
vi.mock('@/lib/axios',()=>({apiClient:mocks}));
describe('período y fechas antes de consultar',()=>{
 afterEach(cleanup);
 it.each(['-1','2026.5',''])('no publica año inválido %s',year=>{
  const change=vi.fn();render(<PeriodInput value="2026-11" onChange={change}/>);
  fireEvent.change(screen.getByLabelText('Año contable'),{target:{value:year}});
  expect(screen.getByRole('alert')).toHaveTextContent('año entero');expect(change).not.toHaveBeenCalled();
 });
 it('conserva cambios legítimos sin tope de año inventado',()=>{
  const change=vi.fn();render(<PeriodInput value="2026-11" onChange={change}/>);
  fireEvent.change(screen.getByLabelText('Año contable'),{target:{value:'1999'}});expect(change).toHaveBeenCalledWith('1999-11');
 });
 it('señala mes inválido recibido',()=>{render(<PeriodInput value="2026-13" onChange={vi.fn()}/>);expect(screen.getByRole('alert')).toHaveTextContent('mes entre 1 y 12');});
 it('no aplica rangos invertidos en bandeja y permite corregirlos',()=>{
  const change=vi.fn();
  function Filters(){const [f,set]=useState({busqueda:'',estado:'TODOS' as const,desde:'2026-11-01',hasta:'2026-11-12'});return <InvoiceFiltersBar filtros={f} onFiltrosChange={n=>{change(n);set(n as typeof f);}} onActualizar={vi.fn()} onEmitir={vi.fn()}/>;}
  render(<Filters/>);
  fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-11-20'}});
  expect(change).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('posterior');expect(screen.getByRole('button',{name:'Actualizar'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Hasta'),{target:{value:'2026-11-30'}});
  expect(change).toHaveBeenCalledWith(expect.objectContaining({desde:'2026-11-20',hasta:'2026-11-30'}));expect(screen.queryByRole('alert')).toBeNull();
 });
 it('el reporte no consulta con rango invertido',async()=>{
  mocks.get.mockClear();const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={qc}><SalesReportPage/></QueryClientProvider></MemoryRouter>);
  await waitFor(()=>expect(mocks.get).toHaveBeenCalled());mocks.get.mockClear();
  fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2099-12-31'}});
  expect(screen.getByRole('alert')).toHaveTextContent('posterior');expect(mocks.get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Hasta'),{target:{value:'2099-12-31'}});
  await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/invoices/reports/sales',{params:{from:'2099-12-31',to:'2099-12-31'}}));qc.clear();
 });
 it('valida calendario sin límite arbitrario de días',()=>{expect(errorRangoFechas('2026-02-30','2026-03-01')).toBeTruthy();expect(errorRangoFechas('1999-01-01','2099-12-31')).toBeUndefined();});
});
