import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { calcularRetencion,liquidarComprobante } from '@/modules/invoices/lib/invoiceRetentions';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import { seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
afterEach(cleanup);
it('el helper respeta base gravada cero y conserva las exclusiones anteriores', () => {
  expect(calcularRetencion(1500, true, 1, 0, 0)).toBe(0);
  expect(calcularRetencion(1680, true, 1, 0, 1000)).toBe(50.4);
  expect(calcularRetencion(1180, true, 1, 141.6, 1000)).toBe(0);
  expect(calcularRetencion(1180, false, 1, 0, 1000)).toBe(0);
});
it('gratuita con ICBPER superior al umbral no genera retención', () => {
  expect(liquidarComprobante([{ base: 2000, afectacion: 'GRATUITA' }], { esAgenteRetencion: true, bolsasPlasticas: 2000 })).toMatchObject({ importeTotal: 1000, montoRetencion: 0, netoPendientePago: 1000 });
});

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => ({ data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : [] })) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => ['10','20'].map(afectacion=>({sku:afectacion==='10'?'GRA':'EXO',descripcion:'Producto',unidad:'NIU',valorUnitario:1000,precioUnitario:afectacion==='10'?1180:1000,afectacion,stock:100,vendible:true}))) }));
it('la página real deja de mostrar retención sin gravada y la conserva en gravada pura', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><MemoryRouter><InvoiceEmissionPage /></MemoryRouter></QueryClientProvider>);
  await seleccionarProductoPrueba('EXO');
  fireEvent.click(screen.getByRole('checkbox', { name: /Agente de Retención/ }));
  expect(screen.queryByText('Retención IGV (3 %)')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Eliminar la línea 1'})); await seleccionarProductoPrueba('GRA');
  expect(screen.getByText('Retención IGV (3 %)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Eliminar la línea 1'})); await seleccionarProductoPrueba('EXO');
  expect(screen.queryByText('Retención IGV (3 %)')).toBeNull(); q.clear();
});
it.each(['EXONERADA', 'INAFECTA', 'GRATUITA'] as const)('la fábrica de comprobantes también excluye retención en %s', afectacion => {
  expect(construir({ tipo: '01', serie: 'F001', correlativo: 1, ruc: '20100070970', razonSocial: 'Receptor ficticio', fecha: '2026-11-13', base: 1000, estado: 'ACEPTADO', agenteRetencion: true, afectacion }).retencion).toBe(0);
});
