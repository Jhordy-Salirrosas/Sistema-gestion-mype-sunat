import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { calcularFlujo } from '@/modules/invoices/components/InvoiceEmitModal';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';
import { calcularDetraccion, calcularRetencion, liquidarComprobante } from '@/modules/invoices/lib/invoiceRetentions';
import { montoDetraccionPara, validarCronograma } from '@/modules/invoices/lib/invoiceDetraccion';
import { borradorAPayloadEmision, problemaDeCronograma } from '@/modules/invoices/lib/invoiceEmitPayload';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));

afterEach(cleanup);
const base = borradorInicial('01', '2026-11-06');
const items = [{ ...base.items[0], valorUnitario: 1000, codigoDetraccion: '027' }];

it('comprobante al crédito con SPOT y retención usa céntimos en el neto y las cuotas', () => {
  const borrador = { ...base, items, codigoDetraccion: '027', agenteRetencion: true, formaPago: 'Credito' as const };
  const flujo = calcularFlujo(borrador);
  expect(calcularDetraccion(1180, 0.04)).toBe(47.2);
  expect(calcularRetencion(1180, true)).toBe(35.4);
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1097.4 });
  expect(validarCronograma([{ monto: 548.7, vencimiento: '2026-12-06' }, { monto: 548.7, vencimiento: '2027-01-06' }], flujo.neto, borrador.fecha).cuadra).toBe(true);
});

it('SPOT sin retención conserva 47.20 en el comprobante y 1132.80 de neto', () => {
  const flujo = calcularFlujo({ ...base, items, codigoDetraccion: '027', agenteRetencion: false });
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1132.8 });
  expect(montoDetraccionPara(1180, '027')).toBe(47.2);
});

it('en contado presenta el monto del comprobante y el depósito redondeado por separado', () => {
  const borrador = { ...base, items, codigoDetraccion: '027', formaPago: 'Contado' as const };
  const liquidacion = liquidarComprobante([{ base: 1000, afectacion: 'GRAVADA' }], { detraccionPorcentaje: 0.04 });
  expect(liquidacion).toMatchObject({ importeTotal: 1180, montoDetraccion: 47.2, netoPendientePago: 1132.8 });
  render(<InvoiceEmitResumen borrador={borrador} />);
  expect(screen.getByText(/Detracción SPOT.*47\.20/)).toBeTruthy();
  expect(screen.getByText(/Depósito.*Banco de la Nación.*47\.00/)).toBeTruthy();
});

it('usa solo líneas sujetas y acepta al enviar cuotas que suman el neto real', () => {
  const borrador = { ...base, codigoDetraccion: '', agenteRetencion: true, formaPago: 'Credito' as const,
    items: [{ ...base.items[0], valorUnitario: 500, codigoDetraccion: '027' },
      { ...base.items[0], clave: 'segunda', valorUnitario: 500, codigoDetraccion: undefined }],
    cuotas: [{ monto: 560.5, vencimiento: '2026-12-06' }, { monto: 560.5, vencimiento: '2027-01-06' }] };
  expect(calcularFlujo(borrador)).toMatchObject({ importeTotal: 1180, detraccion: 23.6, neto: 1121 });
  expect(problemaDeCronograma(borrador)).toBeNull();
  expect(borradorAPayloadEmision(borrador).items.map((item) => item.codigoDetraccion)).toEqual(['027', undefined]);
});

it('en el modal reparte cuotas según la línea sujeta y la retención seleccionada', () => {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal tipoInicial="01" fecha="2026-11-06" existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '027' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Agente de Retención/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Crédito' }));
  expect(screen.getByText(/Pago a crédito en .*Neto pendiente S\/ 1097\.40/)).toBeTruthy();
  expect(screen.getByText(/El cronograma cuadra al céntimo/)).toBeTruthy();
  query.clear();
});
