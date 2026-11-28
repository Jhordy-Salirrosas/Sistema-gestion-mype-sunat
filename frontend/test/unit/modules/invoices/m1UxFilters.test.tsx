import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { InvoiceFiltersBar } from '@/modules/invoices/components/InvoiceFiltersBar';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
import { useInvoiceFiltros } from '@/modules/invoices/lib/useInvoiceFiltros';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
afterEach(()=>{cleanup();sessionStorage.clear();});
function Filtros(){const[filtros,setFiltros]=useInvoiceFiltros();const l=useLocation();return <><InvoiceFiltersBar filtros={filtros} onFiltrosChange={setFiltros} onActualizar={()=>{}}/><output aria-label="URL">{l.search}</output></>;}
it('recupera de URL, muestra chips y elimina uno o todos sin ocultar filtros',()=>{
 const query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={query}><MemoryRouter initialEntries={['/invoices/facturas?m1=1&busqueda=F001&estado=OBSERVADO&desde=2026-11-01']}><Filtros/></MemoryRouter></QueryClientProvider>);
 expect(screen.getByLabelText('Buscar comprobantes')).toHaveValue('F001');expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01');
 fireEvent.click(screen.getByRole('button',{name:'Quitar filtro busqueda'}));expect(screen.getByLabelText('URL')).not.toHaveTextContent('busqueda=');expect(screen.getByRole('button',{name:'Quitar filtro estado'})).toHaveTextContent('Aceptada con observación');
 fireEvent.click(screen.getByRole('button',{name:'Limpiar todo'}));expect(screen.getByLabelText('URL')).toHaveTextContent('?m1=1');expect(screen.queryByRole('button',{name:'Quitar filtro estado'})).toBeNull();
});
it('orden y paginación se aplican al conjunto y no muestran paginador para una página',()=>{
 const docs=Array.from({length:26},(_,i)=>construir({tipo:'01',serie:'F001',correlativo:i+1,ruc:'20100070970',razonSocial:`Cliente ${i+1}`,fecha:'2026-11-19',base:(i+1)*100,estado:'ACEPTADO'}));
 const callbacks={onVerXml:vi.fn(),onVerCdr:vi.fn(),onDescargarPdf:vi.fn(),onReintentarCdr:vi.fn()};
 const {rerender}=render(<InvoiceTable comprobantes={docs} {...callbacks}/>);
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));expect(screen.getByText('Página 2 de 2')).toBeVisible();
 fireEvent.change(screen.getByLabelText('Ordenar comprobantes'),{target:{value:'total-desc'}});expect(screen.getByText('Página 1 de 2')).toBeVisible();
 expect(screen.getAllByRole('row')[1]).toHaveTextContent('F001-00000026');rerender(<InvoiceTable comprobantes={docs.slice(0,1)} {...callbacks}/>);expect(screen.queryByRole('navigation',{name:'Paginación de comprobantes'})).toBeNull();
});
