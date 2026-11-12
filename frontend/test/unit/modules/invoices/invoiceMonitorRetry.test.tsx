import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvoiceMonitorPage, { estadoDeMonitor } from '@/modules/invoices/pages/InvoiceMonitorPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { ALERTAS_VACIAS } from '@/modules/invoices/lib/invoiceAlertas';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({
  invoicesApi: { getAgregados: vi.fn(), getAlertas: vi.fn(), getInvoices: vi.fn(), getInvoiceById: vi.fn(), retryCdr: vi.fn() },
}));

const comprobante = aInvoice({
  id: 'invoice-52', tipo_comprobante: '01', serie: 'F001', correlativo: 52,
  numero: 'F001-00000052', fecha_emision: '2026-11-01', estado: 'ERROR_RED',
  monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970',
  cliente_nombre: 'Cliente de prueba', cdr_codigo: null,
});

beforeEach(() => {
  vi.mocked(invoicesApi.getAgregados).mockResolvedValue([]);
  vi.mocked(invoicesApi.getAlertas).mockResolvedValue(ALERTAS_VACIAS);
  vi.mocked(invoicesApi.getInvoiceById).mockRejectedValue(new Error('Detalle no disponible'));
  vi.mocked(invoicesApi.getInvoices).mockImplementation(async (_page, filtros) => ({
    data: filtros?.estado === 'ERROR_RED' ? [comprobante] : [],
    total: filtros?.estado === 'ERROR_RED' ? 1 : 0,
    page: 1, pageSize: 20, totalPages: 1,
  }));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('retroalimentación del reintento de CDR en el Monitor', () => {
  it.each([
    { encolado: true, mensaje: 'El comprobante se reencoló para consultar su CDR', titulo: 'Comprobante reencolado' },
    { encolado: false, mensaje: 'El comprobante está en la DLQ; requiere revisión manual', titulo: 'Comprobante no reencolado' },
  ])('muestra el resultado encolado=$encolado y lo conserva al refrescar', async ({ encolado, mensaje, titulo }) => {
    vi.mocked(invoicesApi.retryCdr).mockResolvedValue({ id: comprobante.id, estado: 'ERROR_RED', encolado, mensaje });
    render(<InvoiceMonitorPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(invoicesApi.getAlertas).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' }).hasAttribute('disabled')).toBe(false));
    const alerta = within(screen.getByRole('alert'));
    expect(alerta.getByText(titulo)).toBeTruthy();
    expect(alerta.getByText(mensaje)).toBeTruthy();
    expect(invoicesApi.retryCdr).toHaveBeenCalledWith(comprobante.id);
    // El refresco automático y uno manual conservan el resultado, aunque
    // el worker todavía no haya cambiado el estado fiscal ERROR_RED.
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(invoicesApi.getAlertas).toHaveBeenCalledTimes(3));
    await screen.findByRole('button', { name: 'Actualizar' });
    expect(within(screen.getByRole('alert')).getByText(mensaje)).toBeTruthy();
  });

  it('extrae el motivo HTTP del servidor y lo conserva al actualizar la lista', async () => {
    vi.mocked(invoicesApi.retryCdr).mockRejectedValue({
      message: 'Request failed with status code 403',
      response: { data: { detail: 'La empresa no tiene permiso para reintentar este comprobante.' } },
    });
    render(<InvoiceMonitorPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    const mensaje = 'La empresa no tiene permiso para reintentar este comprobante.';
    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(within(screen.getByRole('alert')).getByText('Comprobante no reencolado')).toBeTruthy();
    expect(screen.queryByText('Request failed with status code 403')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(invoicesApi.getAlertas).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: 'Actualizar' });
    expect(within(screen.getByRole('alert')).getByText(mensaje)).toBeTruthy();
  });
});

it('F8 distingue DLQ por bitácora y filtra la misma tabla por estado', async () => {
  const dlq = { ...comprobante, id: 'invoice-dlq', numero: 'F001-00000053', estadoBackend: 'PENDIENTE', historial: [{ id: 'h1', fecha: '2026-11-07', mensaje: 'Rescate manual: EN_DLQ. Requiere revisión.' }] };
  const pendiente = { ...comprobante, id: 'invoice-pendiente', numero: 'F001-00000054', estadoBackend: 'PENDIENTE' };
  vi.mocked(invoicesApi.getInvoices).mockImplementation(async (_page, filtros) => ({ data: filtros?.estado === 'PENDIENTE' ? [{ ...dlq, historial: undefined }, pendiente] : filtros?.estado === 'ERROR_RED' ? [comprobante] : [], total: 3, page: 1, pageSize: 100, totalPages: 1 }));
  vi.mocked(invoicesApi.getInvoiceById).mockImplementation(async (id) => id === dlq.id ? dlq : id === pendiente.id ? pendiente : comprobante);
  render(<InvoiceMonitorPage />);
  await screen.findByText(dlq.numero);
  expect(invoicesApi.getInvoiceById).toHaveBeenCalledWith(dlq.id);
  const fila = screen.getByText(dlq.numero).closest('tr')!;
  expect(within(fila).getByText('DLQ')).toBeTruthy();
  expect(within(fila).queryByText('PENDIENTE')).toBeNull();
  fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'), { target: { value: 'DLQ' } });
  expect(screen.getByText(dlq.numero)).toBeTruthy(); expect(screen.queryByText(pendiente.numero)).toBeNull(); expect(screen.queryByText(comprobante.numero)).toBeNull();
  expect(screen.getByText('Comprobantes en vuelo (1)')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'), { target: { value: 'INCERTIDUMBRE_TRANSPORTE' } });
  expect(screen.getByText(comprobante.numero)).toBeTruthy(); expect(screen.queryByText(dlq.numero)).toBeNull();
});

it('F8 deja de rotular DLQ cuando la bitácora registra un reencolado posterior', () => {
  const historial = [{ id: '1', fecha: '2026-11-06', mensaje: 'Rescate: EN_DLQ.' }, { id: '2', fecha: '2026-11-07', mensaje: 'Rescate: ENCOLADO.' }];
  expect(estadoDeMonitor({ ...comprobante, estadoBackend: 'PENDIENTE', historial })).toBe('PENDIENTE');
});

it('DLQ ofrece reintento efectivo, muestra resultado y deja de rotularla DLQ al refrescar', async () => {
  let rescatado = false;
  const dlq = { ...comprobante, id: 'invoice-57', numero: 'F001-00000057', estadoBackend: 'EN_COLA', historial: [{ id: 'h', fecha: '2026-11-10', mensaje: 'Rescate manual: EN_DLQ.' }] };
  vi.mocked(invoicesApi.getInvoices).mockImplementation(async (_p, filtro) => ({ data: filtro?.estado === 'EN_COLA' ? [dlq] : [], total: 1, page: 1, pageSize: 100, totalPages: 1 }));
  vi.mocked(invoicesApi.getInvoiceById).mockImplementation(async () => rescatado ? { ...dlq, historial: [...dlq.historial, { id: 'h2', fecha: '2026-11-10', mensaje: 'Rescate manual: ENCOLADO.' }] } : dlq);
  vi.mocked(invoicesApi.retryCdr).mockImplementation(async () => { rescatado = true; return { id: dlq.id, estado: 'EN_COLA', encolado: true, mensaje: 'Comprobante reencolado manualmente.', resultadoCola: 'ENCOLADO' } as never; });
  render(<InvoiceMonitorPage />);
  const fila = (await screen.findByText(dlq.numero)).closest('tr')!;
  await within(fila).findByText('DLQ'); fireEvent.click(within(fila).getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('Comprobante reencolado manualmente.');
  await waitFor(() => expect(within(screen.getByText(dlq.numero).closest('tr')!).queryByText('DLQ')).toBeNull());
  expect(invoicesApi.retryCdr).toHaveBeenCalledExactlyOnceWith(dlq.id);
});
it.each(['ACEPTADO', 'OBSERVADO', 'ANULADO'])('una referencia DLQ histórica no habilita acción para %s', async estado => {
  const inv = { ...comprobante, estadoBackend: estado, historial: [{ id: 'h', fecha: '2026-11-10', mensaje: 'EN_DLQ' }] };
  vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(inv);
  render(<InvoiceMonitorPage />); await screen.findByText(inv.numero);
  expect(within(screen.getByText(inv.numero).closest('tr')!).queryByRole('button', { name: 'Reintentar' })).toBeNull();
});

it('incertidumbre de transporte muestra motivo y permite conciliar sin llamarlo error de red', async () => {
  const incierto = { ...comprobante, estadoBackend: 'ENVIADO', resultadoPresentacion: { origen: 'TRANSPORTE_INCIERTO' as const, codigo: 'M1_TRANSPORT_UNCERTAIN', motivo: 'Incertidumbre de transporte: Beta sin CDR' } };
  vi.mocked(invoicesApi.getInvoices).mockImplementation(async (_page, filtros) => ({ data: filtros?.estado === 'ENVIADO' ? [incierto] : [], total: 1, page: 1, pageSize: 20, totalPages: 1 }));
  vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(incierto);
  vi.mocked(invoicesApi.retryCdr).mockResolvedValue({ id: incierto.id, estado: 'ENVIADO', encolado: true, mensaje: 'Comprobante reencolado para conciliar' });
  render(<InvoiceMonitorPage />);
  const boton = await screen.findByRole('button', { name: 'Reintentar' });
  const fila = boton.closest('tr')!;
  expect(within(fila).getByText('Incertidumbre de transporte')).toBeTruthy();
  expect(within(fila).getByText(incierto.resultadoPresentacion.motivo)).toBeTruthy();
  expect(within(fila).queryByText(/Error de red|No llegó a SUNAT/)).toBeNull();
  fireEvent.click(boton);
  await waitFor(() => expect(invoicesApi.retryCdr).toHaveBeenCalledWith(incierto.id));
});

it('6c-5 ofrece una opción de incertidumbre que incluye ERROR_RED y la clase explícita',async()=>{
 const incierto={...comprobante,id:'incierto',clienteRazonSocial:'Fila incierta',resultadoPresentacion:{origen:'TRANSPORTE_INCIERTO' as const,codigo:null,motivo:'Consulta pendiente'}};
 vi.mocked(invoicesApi.getInvoices).mockImplementation(async(_p,f)=>({data:f?.estado==='ERROR_RED'?[comprobante,incierto]:[],total:2,page:1,pageSize:20,totalPages:1}));
 render(<InvoiceMonitorPage/>);await screen.findByText('Fila incierta');
 expect(screen.getAllByRole('option',{name:'Incertidumbre de transporte'})).toHaveLength(1);
 fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'),{target:{value:'INCERTIDUMBRE_TRANSPORTE'}});
 expect(screen.getByText('Cliente de prueba')).toBeTruthy();expect(screen.getByText('Fila incierta')).toBeTruthy();
 expect(invoicesApi.getInvoices).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({estado:'ERROR_RED'}));
});

it('preparación local conserva Reintentar y no entra al filtro de incertidumbre', async () => {
  const local = { ...comprobante, resultadoPresentacion: { origen: 'PREPARACION_LOCAL' as const, codigo: 'M1_PREPARATION_DATOS_INVALIDOS', motivo: 'Datos inválidos', recuperable: false } };
  vi.mocked(invoicesApi.getInvoices).mockImplementation(async (_page, filtros) => ({ data: filtros?.estado === 'ERROR_RED' ? [local] : [], total: 1, page: 1, pageSize: 20, totalPages: 1 }));
  render(<InvoiceMonitorPage />);
  await screen.findByRole('button', { name: 'Reintentar' });
  const row = screen.getByText(local.numero).closest('tr')!;
  expect(within(row).getByText('Bloqueado en preparación local')).toBeTruthy();
  expect(within(row).getByText('Datos inválidos')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'), { target: { value: 'INCERTIDUMBRE_TRANSPORTE' } });
  expect(screen.queryByText(local.numero)).toBeNull();
  fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'), { target: { value: 'PREPARACION_LOCAL' } });
  expect(screen.getByText(local.numero)).toBeTruthy();
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
