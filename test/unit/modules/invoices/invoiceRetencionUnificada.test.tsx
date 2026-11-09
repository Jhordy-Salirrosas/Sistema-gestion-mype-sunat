import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calcularRetencion } from '@/modules/invoices/lib/invoiceRetentions';
import { InvoiceEmitModal, calcularFlujo } from '@/modules/invoices/components/InvoiceEmitModal';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { validarCronograma } from '@/modules/invoices/lib/invoiceDetraccion';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
afterEach(cleanup);

it.each([[118, 0], [700, 0], [701, 21.03], [1180, 35.4], [1770, 53.1]])('retiene sobre %s el importe %s', (total, esperado) => {
  expect(calcularRetencion(total, true)).toBe(esperado);
});

it('cuadra el cronograma después de detracción y retención', () => {
  const base = borradorInicial('01', '2026-11-06');
  const b = { ...base, agenteRetencion: true, codigoDetraccion: '027', items: [{ ...base.items[0], valorUnitario: 1000, codigoDetraccion: '027' }] };
  const flujo = calcularFlujo(b);
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1097.4 });
  expect(validarCronograma([{ monto: 548.7, vencimiento: '2026-12-06' }, { monto: 548.7, vencimiento: '2027-01-06' }], flujo.neto, b.fecha).cuadra).toBe(true);
});

it('el modal distribuye el neto tras la retención al elegir crédito', () => {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="01" fecha="2026-11-06" existentes={[]} clienteConCredito onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Agente de Retención/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Crédito' }));
  expect(screen.getByText(/Pago a crédito en .*Neto pendiente S\/ 1144\.60/)).toBeTruthy();
  expect(screen.getByText(/El cronograma cuadra al céntimo/)).toBeTruthy();
  query.clear();
});

it('el resumen calcula la retención sobre el total tras descuento global', () => {
  const base = borradorInicial('01', '2026-11-06');
  const b = { ...base, agenteRetencion: true, descuentoGlobal: { codigo: '03' as const, monto: 100 }, items: [{ ...base.items[0], valorUnitario: 1000 }] };
  render(<InvoiceEmitResumen borrador={b} />);
  expect(screen.getByText(/Retención 3%.*32\.40/)).toBeTruthy();
});
