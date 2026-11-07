import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvoiceMonitorPage from '@/modules/invoices/pages/InvoiceMonitorPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { ALERTAS_VACIAS } from '@/modules/invoices/lib/invoiceAlertas';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({
  invoicesApi: { getAlertas: vi.fn(), getInvoices: vi.fn(), retryCdr: vi.fn() },
}));

const comprobante = aInvoice({
  id: 'invoice-52', tipo_comprobante: '01', serie: 'F001', correlativo: 52,
  numero: 'F001-00000052', fecha_emision: '2026-11-01', estado: 'ERROR_RED',
  monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970',
  cliente_nombre: 'Cliente de prueba', cdr_codigo: null,
});

beforeEach(() => {
  vi.mocked(invoicesApi.getAlertas).mockResolvedValue(ALERTAS_VACIAS);
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
