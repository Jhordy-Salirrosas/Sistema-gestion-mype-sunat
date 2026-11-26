import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { InvoicePaymentPanel } from '@/modules/invoices/components/InvoicePaymentPanel';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { emitirComprobante: vi.fn() } }));
vi.mock('@/modules/customs/services/masterDataApi', () => ({ masterDataApi: { getPartners: vi.fn(async () => []) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [
  { sku: 'SERV', descripcion: 'Servicio', unidad: 'NIU', valorUnitario: 100, precioUnitario: 118, afectacion: '10', stock: 100, vendible: true },
]) }));
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ token: 'fixture', user: { id: 'admin', email: 'admin@example.invalid', role: 'ADMIN' } });
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data:
    url === '/invoices/config' ? { series: seriesConfiguradasPrueba } :
    url === '/invoices/commercial-defaults' ? { forma_pago: 'Contado', medio_pago: 'EFECTIVO' } :
    url === '/invoices/warehouses' ? [{ warehouse_code: 'ALM-01', description: 'Principal' }] : [],
  }));
  vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({ numero: 'F001-00000001', monto_total: 118, avisos: [] } as never);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; useAuthStore.getState().logout(); });
async function mount() {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(q);
  render(<QueryClientProvider client={q}><MemoryRouter><InvoiceEmissionPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByLabelText('Buscar producto');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Emitir comprobante' })).toBeEnabled());
}
async function preparar() {
  await mount();
  fireEvent.change(screen.getByLabelText('RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente de prueba' } });
  await seleccionarProductoPrueba();
}

it('agrupa operación a la izquierda y facturación, liquidación y emisión en el otro panel', async () => {
  await mount();
  const operacion = within(screen.getByRole('region', { name: 'Operación' }));
  const pago = within(screen.getByRole('region', { name: 'Facturación y pago' }));
  expect(operacion.getByLabelText('RUC del cliente')).toBeVisible();
  expect(operacion.getByLabelText('Almacén de salida')).toBeVisible();
  expect(operacion.getByLabelText('Serie configurada')).toBeVisible();
  expect(operacion.getByLabelText('Buscar producto')).toBeVisible();
  expect(operacion.queryByLabelText('Tipo de comprobante')).toBeNull();
  expect(pago.getByLabelText('Tipo de comprobante')).toBeVisible();
  expect(pago.getByLabelText('Fecha de emisión')).toBeVisible();
  expect(pago.getByText('Liquidación')).toBeVisible();
  expect(pago.getByRole('button', { name: 'Emitir comprobante' })).toHaveTextContent('Revisar y emitir');
  expect(pago.getByRole('button', { name: 'Crédito' })).toBeDisabled();
});

it('mantiene facturación y liquidación en flujo, sin panel fijo ni scroll interno', async () => {
  await mount();
  const panel = screen.getByRole('region', { name: 'Facturación y pago' });
  const card = panel.querySelector('[data-slot="card"]')!;
  const content = card.querySelector('[data-slot="card-content"]')!;
  for (const element of [panel, card, content]) {
    expect(element.className).not.toMatch(/sticky|top-4|max-h-|overflow-(?:[xy]-)?(?:auto|scroll|hidden|clip)|min-h-0/);
    expect(element).not.toHaveAttribute('style');
  }
  const liquidacion = within(panel).getByRole('heading', { name: 'Liquidación' });
  const seccion = liquidacion.parentElement!;
  const medio = within(panel).getByLabelText('Medio de pago');
  const total = within(seccion).getByText('Importe total');
  const emitir = within(seccion).getByRole('button', { name: 'Emitir comprobante' });
  expect(content.lastElementChild).toBe(seccion);
  expect(seccion.className).not.toMatch(/shrink-0|border-t|bg-muted/);
  expect(liquidacion).toHaveAttribute('id', 'emision-liquidacion');
  expect(liquidacion).toHaveAttribute('tabindex', '-1');
  expect(medio.compareDocumentPosition(liquidacion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(liquidacion.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(total.compareDocumentPosition(emitir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(emitir.closest('form')).toBe(panel.closest('form'));
  const resumenMovil = screen.getByLabelText('Resumen de pago');
  expect(resumenMovil).toHaveClass('sticky', 'bottom-0', 'lg:hidden');
  expect(panel).not.toContainElement(resumenMovil);
});

it.each([['Efectivo', 'EFECTIVO'], ['Yape', 'YAPE'], ['Tarjeta', 'TARJETA']] as const)(
  'el acceso %s conserva el contrato de emisión y no envía entrega ni vuelto', async (nombre, medio) => {
    await preparar();
    fireEvent.click(screen.getByRole('button', { name: nombre }));
    expect(screen.getByRole('button', { name: nombre })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Medio de pago')).toHaveValue(medio);
    if (medio === 'EFECTIVO') fireEvent.change(screen.getByLabelText('Monto entregado (S/)'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir comprobante' }));
    expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar emisión' }));
    await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0];
    expect(payload).toMatchObject({ tipo_comprobante: '01', forma_pago: 'Contado', medio_pago: medio,
      customer_legal_name: 'Cliente de prueba', items: [{ codigo: 'SERV', cantidad: 1, valorUnitario: 100 }] });
    expect(Object.keys(payload).sort()).toEqual([
      'almacen', 'tipo_comprobante', 'serie', 'customer_identity_type', 'customer_identity_number',
      'customer_legal_name', 'fecha_emision', 'agente_retencion', 'forma_pago', 'medio_pago', 'cuotas', 'descuento_global', 'items',
    ].sort());
  },
);

it('calcula el vuelto en vivo al cambiar la entrega o la cantidad de productos', async () => {
  await preparar();
  const entrega = screen.getByLabelText('Monto entregado (S/)');
  const vuelto = () => within(screen.getByRole('status', { name: 'Vuelto' })).getByRole('status');
  fireEvent.change(entrega, { target: { value: '300' } });
  expect(vuelto()).toHaveTextContent('S/ 182.00');
  fireEvent.change(screen.getByLabelText('Cantidad de la línea 1', { exact: true }), { target: { value: '2' } });
  expect(vuelto()).toHaveTextContent('S/ 64.00');
  fireEvent.change(entrega, { target: { value: '250,01' } });
  expect(vuelto()).toHaveTextContent('S/ 14.01');
  fireEvent.click(screen.getByRole('button', { name: 'Yape' }));
  expect(screen.queryByLabelText('Monto entregado (S/)')).toBeNull();
  expect(screen.queryByRole('status', { name: 'Vuelto' })).toBeNull();
});

it('una entrega insuficiente muestra pendiente y mantiene habilitada la emisión', async () => {
  await preparar();
  fireEvent.change(screen.getByLabelText('Monto entregado (S/)'), { target: { value: '100' } });
  expect(screen.getByText('Pendiente de entregar: S/ 18.00')).toBeVisible();
  expect(within(screen.getByRole('status', { name: 'Vuelto' })).getByRole('status')).toHaveTextContent('S/ 0.00');
  expect(screen.getByRole('button', { name: 'Emitir comprobante' })).toBeEnabled();
});

it('conserva todos los medios existentes y selecciona crédito como forma de pago', () => {
  const cambiar = vi.fn();
  const props = { formaPago: 'Contado' as const, medioPago: 'EFECTIVO' as const, creditoHabilitado: true, pagoDirecto: 118, onCambiar: cambiar };
  const { rerender } = render(<InvoicePaymentPanel {...props} />);
  for (const medio of ['PLIN', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE']) {
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: medio } });
    expect(cambiar).toHaveBeenLastCalledWith('Contado', medio);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Crédito' }));
  expect(cambiar).toHaveBeenLastCalledWith('Credito');
  rerender(<InvoicePaymentPanel {...props} formaPago="Credito" />);
  expect(screen.getByRole('button', { name: 'Crédito' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByLabelText('Medio de pago')).toBeNull();
  expect(screen.queryByLabelText('Monto entregado (S/)')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
  expect(cambiar).toHaveBeenLastCalledWith('Contado', 'EFECTIVO');
});

it('el vuelto usa el pago directo con depósito BN y retención ya descontados', () => {
  render(<InvoicePaymentPanel formaPago="Contado" medioPago="EFECTIVO" creditoHabilitado={false} pagoDirecto={88.17} onCambiar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Monto entregado (S/)'), { target: { value: '100' } });
  expect(within(screen.getByRole('status', { name: 'Vuelto' })).getByRole('status')).toHaveTextContent('S/ 11.83');
});


it('valida al salir del documento, oculta el error durante la edición y enlaza el resumen al campo', async () => {
  await mount();
  expect(screen.queryByText('La factura exige el RUC del cliente.')).toBeNull();
  const doc=screen.getByLabelText('RUC del cliente');
  fireEvent.focus(doc);fireEvent.change(doc,{target:{value:'12'}});
  expect(doc).toHaveAttribute('aria-invalid','false');
  fireEvent.blur(doc);
  expect(doc).toHaveAttribute('aria-invalid','true');
  fireEvent.focus(doc);expect(doc).toHaveAttribute('aria-invalid','false');
  fireEvent.change(doc,{target:{value:''}});fireEvent.blur(doc);
  fireEvent.click(screen.getByRole('button',{name:'Emitir comprobante'}));
  const summary=screen.getByRole('alert',{name:'Revise los campos indicados'});
  await waitFor(()=>expect(summary).toHaveFocus());
  const link=within(summary).getByRole('link',{name:'La factura exige el RUC del cliente.'});
  fireEvent.click(link);expect(doc).toHaveFocus();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('revisión permite cambiar una sección sin enviar ni perder las líneas', async () => {
  await preparar();fireEvent.click(screen.getByRole('button',{name:'Emitir comprobante'}));
  const dialog=screen.getByRole('dialog',{name:'Revisar y emitir'});
  expect(within(dialog).getByText('Cliente de prueba',{exact:false})).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:'Cambiar cliente'}));
  await waitFor(()=>expect(screen.getByLabelText('RUC del cliente')).toHaveFocus());
  expect(screen.getByLabelText('Cantidad de la línea 1',{exact:true})).toHaveValue('1');
  expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('recupera el borrador real de la pantalla y conserva lo digitado tras un error de envío',async()=>{
 localStorage.clear();useAuthStore.setState({activeCompany:{tenantId:'empresa',ruc:'20100070970',razonSocial:'Empresa'}});
 await preparar();fireEvent.change(screen.getByLabelText('Cantidad de la línea 1',{exact:true}),{target:{value:'2'}});
 const key='m1:emision:v1:empresa:admin';
 await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)??'null')?.data.items[0].cantidad).toBe(2),{timeout:2500});
 cleanup();await mount();expect(screen.getByRole('button',{name:'Retomar borrador'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Retomar borrador'}));
 await waitFor(()=>expect(screen.getByLabelText('Razón social / nombre')).toHaveValue('Cliente de prueba'));
 expect(screen.getByLabelText('Cantidad de la línea 1',{exact:true})).toHaveValue('2');
 vi.mocked(invoicesApi.emitirComprobante).mockRejectedValueOnce({response:{data:{message:'El servicio no pudo procesar el intento.'}}});
 fireEvent.click(screen.getByRole('button',{name:'Emitir comprobante'}));fireEvent.click(await screen.findByRole('button',{name:'Confirmar emisión'}));
 await screen.findByText('No se emitió');expect(screen.getByLabelText('Cantidad de la línea 1',{exact:true})).toHaveValue('2');expect(screen.getByLabelText('Razón social / nombre')).toHaveValue('Cliente de prueba');expect(localStorage.getItem(key)).not.toBeNull();localStorage.removeItem(key);
});
