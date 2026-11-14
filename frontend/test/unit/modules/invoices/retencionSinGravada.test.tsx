import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { liquidarComprobante, calcularRetencion } from '@/modules/invoices/lib/invoiceRetentions';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';
import type { AfectacionIgv } from '@/modules/invoices/lib/invoiceTaxes';
const casos: { nombre: string; lineas: { base: number; afectacion: AfectacionIgv }[]; total: number; retencion: number }[] = [
  { nombre: 'exonerada', lineas: [{ base: 1000, afectacion: 'EXONERADA' }], total: 1000, retencion: 0 },
  { nombre: 'inafecta', lineas: [{ base: 1500, afectacion: 'INAFECTA' }], total: 1500, retencion: 0 },
  { nombre: 'exo e inafecta', lineas: [{ base: 1000, afectacion: 'EXONERADA' }, { base: 500, afectacion: 'INAFECTA' }], total: 1500, retencion: 0 },
  { nombre: 'gratuita', lineas: [{ base: 1000, afectacion: 'GRATUITA' }], total: 0, retencion: 0 },
  { nombre: 'mixto conserva el paquete', lineas: [{ base: 1000, afectacion: 'GRAVADA' }, { base: 500, afectacion: 'EXONERADA' }], total: 1680, retencion: 50.4 },
  { nombre: 'gravada pura conserva el paquete', lineas: [{ base: 1000, afectacion: 'GRAVADA' }], total: 1180, retencion: 35.4 },
];
afterEach(cleanup);
it.each(casos)('$nombre: liquidación, flujo y resumen coinciden sin cambiar la base de mixtos', ({ lineas, total, retencion }) => {
  expect(liquidarComprobante(lineas, { esAgenteRetencion: true })).toMatchObject({ importeTotal: total, montoRetencion: retencion, netoPendientePago: total - retencion });
  const b = borradorInicial('01', '2026-11-13'); b.agenteRetencion = true;
  b.items = lineas.map((l, i) => ({ ...b.items[0], clave: String(i), descripcion: 'Bien ficticio', valorUnitario: l.base, afectacion: l.afectacion }));
  expect(calcularFlujo(b)).toMatchObject({ importeTotal: total, neto: total - retencion });
  render(<InvoiceEmitResumen borrador={b} />);
  if (retencion === 0) expect(screen.queryByText(/Retención 3%/)).toBeNull();
  else expect(screen.getByText(new RegExp(`Retención 3%.*${retencion.toFixed(2).replace('.', '\\.')}`))).toBeTruthy();
});
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
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
it('la página real deja de mostrar retención sin gravada y la conserva en gravada pura', () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><MemoryRouter><InvoiceEmissionPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Afectación de la línea 1'), { target: { value: 'EXONERADA' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Agente de Retención/ }));
  expect(screen.queryByText('Retención IGV (3 %)')).toBeNull();
  fireEvent.change(screen.getByLabelText('Afectación de la línea 1'), { target: { value: 'GRAVADA' } });
  expect(screen.getByText('Retención IGV (3 %)')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Afectación de la línea 1'), { target: { value: 'EXONERADA' } });
  expect(screen.queryByText('Retención IGV (3 %)')).toBeNull(); q.clear();
});
it.each(['EXONERADA', 'INAFECTA', 'GRATUITA'] as const)('la fábrica de comprobantes también excluye retención en %s', afectacion => {
  expect(construir({ tipo: '01', serie: 'F001', correlativo: 1, ruc: '20100070970', razonSocial: 'Receptor ficticio', fecha: '2026-11-13', base: 1000, estado: 'ACEPTADO', agenteRetencion: true, afectacion }).retencion).toBe(0);
});
