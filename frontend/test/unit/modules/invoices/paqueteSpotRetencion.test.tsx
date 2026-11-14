import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RetencionMaestro } from '@/modules/invoices/components/RetencionMaestro';
import { liquidarComprobante, calcularRetencion } from '@/modules/invoices/lib/invoiceRetentions';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorConLinea as borradorInicial } from '../../../fixtures/invoiceEmissionProduct';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
afterEach(cleanup);
it('SPOT y retención no reducen dos veces el neto; sin SPOT efectivo se conserva retención', () => {
  const lineas = [{ base: 1000, afectacion: 'GRAVADA' as const }];
  expect(liquidarComprobante(lineas, { esAgenteRetencion: true, detraccionPorcentaje: .12 })).toMatchObject({ importeTotal: 1180, montoDetraccion: 141.6, montoRetencion: 0, netoPendientePago: 1038.4 });
  expect(calcularRetencion(1180, true, 1, 0)).toBe(35.4);
  expect(calcularRetencion(1180, true, 1, 141.6)).toBe(0);
});
it.each([[false, .12, 141.6, 0, 1038.4], [true, 0, 0, 35.4, 1144.6]] as const)('régimen único conserva exactamente sus importes', (esAgenteRetencion, detraccionPorcentaje, montoDetraccion, montoRetencion, netoPendientePago) => {
  expect(JSON.stringify(liquidarComprobante([{ base: 1000, afectacion: 'GRAVADA' }], { esAgenteRetencion, detraccionPorcentaje }))).toBe(JSON.stringify({ opGravada: 1000, opExonerada: 0, opInafecta: 0, opGratuita: 0, igv: 180, importeTotal: 1180, montoRetencion, montoDetraccion, netoPendientePago }));
});
it('flujo y payload de emisión excluyen la combinación aunque el maestro marque retención', () => {
  const b = borradorInicial('01', '2026-11-13'); b.clienteDoc = '20100070970'; b.clienteRazonSocial = 'Receptor'; b.agenteRetencion = true;
  b.items = [{ ...b.items[0], descripcion: 'Servicio', valorUnitario: 1000, codigoDetraccion: '012' }];
  expect(calcularFlujo(b)).toMatchObject({ importeTotal: 1180, detraccion: 141.6, neto: 1038.4 });
  expect(borradorAPayloadEmision(b).agente_retencion).toBe(false);
});
it('el control queda desmarcado y bloqueado con explicación, y se rehabilita al retirar SPOT', () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); const onChange = vi.fn();
  const control = (spot: boolean) => <QueryClientProvider client={q}><RetencionMaestro documento="" razonSocial="" valor onChange={onChange} spot={spot} /></QueryClientProvider>;
  const { rerender } = render(control(true)); const input = screen.getByRole('checkbox') as HTMLInputElement;
  expect(input.disabled).toBe(true); expect(input.checked).toBe(false); expect(screen.getByText(/no aplica a operaciones sujetas al SPOT/)).toBeTruthy();
  rerender(control(false)); expect(input.disabled).toBe(false); expect(input.checked).toBe(true); q.clear();
});
