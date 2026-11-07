import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { CATALOGO_59_MEDIOS_PAGO } from '@/modules/invoices/lib/medioPagoDetraccion';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: {
  buscarClientes: vi.fn(async () => []), emitirComprobante: vi.fn(async () => { throw new Error('Respuesta de prueba'); }),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('conserva los 22 códigos exactos y omite el campo sin detracción efectiva, incluso si quedó elegido', () => {
  expect(Object.keys(CATALOGO_59_MEDIOS_PAGO)).toHaveLength(22);
  const b = { ...borradorInicial('01', hoyEnLima()), medioPagoDetraccion: '003' as const };
  expect(borradorAPayloadEmision(b)).not.toHaveProperty('medio_pago_detraccion');
});
it.each(['modal', 'pagina'])('%s: solo aparece con detracción, bloquea vacío y envía el código elegido', async (via) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{via === 'modal'
    ? <InvoiceEmitModal tipoInicial="01" fecha={hoyEnLima()} existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()} />
    : <InvoiceEmissionPage />}</MemoryRouter></QueryClientProvider>);
  expect(screen.queryByLabelText('Medio de pago de la detracción')).toBeNull();
  fireEvent.change(screen.getByLabelText(via === 'modal' ? 'RUC / DNI del cliente' : 'RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente de prueba' } });
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Servicio' } });
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '027' } });
  const selector = screen.getByLabelText('Medio de pago de la detracción') as HTMLSelectElement;
  expect(selector.value).toBe('');
  expect(selector.options).toHaveLength(23);
  const emitir = screen.getByRole('button', { name: /Emitir.*factura|Emitir comprobante|Emitir Factura|Emitir a SUNAT/i });
  fireEvent.click(emitir);
  expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
  fireEvent.change(selector, { target: { value: '003' } });
  fireEvent.click(emitir);
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ medio_pago_detraccion: '003' })));
  fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '' } });
  expect(screen.queryByLabelText('Medio de pago de la detracción')).toBeNull();
  client.clear();
});
