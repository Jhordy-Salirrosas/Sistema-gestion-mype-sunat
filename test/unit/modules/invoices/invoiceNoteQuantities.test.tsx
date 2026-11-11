import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { limitesNota } from '@/modules/invoices/lib/invoiceNoteQuantities';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { apiClient } from '@/lib/axios';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const clientes: QueryClient[] = [];
afterEach(() => { cleanup(); clientes.forEach(q => q.clear()); clientes.length = 0; vi.resetAllMocks(); });
const item = (cantidad: number) => ({ ...itemVacio(String(cantidad)), codigo: 'MAT-1', cantidad });
it('descuenta las otras filas del mismo SKU, con cantidades fraccionarias exactas', () => {
 const saldos = [{ codigo: 'MAT-1', original: 5, pendiente: 2 }];
 expect(limitesNota([item(.7), item(1.3)], saldos, '07')).toEqual({ maximos: [.7, 1.3], errores: [] });
 expect(limitesNota([item(2), item(1)], saldos, '07').errores).toHaveLength(2);
 expect(limitesNota([item(3)], saldos, '13')).toEqual({ maximos: [5], errores: [] });
});
it('sin cantidades no inventa un máximo; SKU ajeno tiene máximo cero', () => {
 expect(limitesNota([item(1)], undefined, '07').errores).toHaveLength(1);
 expect(limitesNota([item(1)], [], '07').maximos).toEqual([0]);
});
function montar(cambioEnConfirmacion = false) {
 const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 100, estado: 'ACEPTADO' });
 const fila = { id: factura.id, tipo_comprobante: '01', serie: 'F001', correlativo: 56, numero: 'F001-00000056', fecha_emision: '2026-11-05', estado: 'ACEPTADO', monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: 'Cliente', cdr_codigo: '0', lineas_origen: [{ codigo: 'MAT-1', descripcion: 'Cemento real', unidad: 'NIU', cantidad: 2, valor_unitario: 50, precio_unitario: 59, afectacion: '10' }] };
 let lecturas = 0;
 vi.mocked(apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/saldo') ? { total: 118, devuelto: 0, disponible: 118, cantidades_pendientes: [{ codigo: 'MAT-1', original: 2, pendiente: cambioEnConfirmacion && ++lecturas > 1 ? 1 : 2 }] } : fila }) as never);
 const q = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clientes.push(q);
 render(<QueryClientProvider client={q}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
 return waitFor(() => expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Cemento real'));
}
it('campo máximo 2, error visible y bloqueo aunque el importe de 3 unidades quepa', async () => {
 await montar(); const cantidad = screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement;
 await waitFor(() => expect(cantidad.max).toBe('2'));
 fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1' } });
 fireEvent.change(cantidad, { target: { value: '3' } });
 expect(screen.getByText(/Supera las unidades disponibles del origen/)).toBeTruthy();
 expect(cantidad.getAttribute('aria-invalid')).toBe('true');
 expect((screen.getByRole('button', { name: 'Emitir Nota de Crédito' }) as HTMLButtonElement).disabled).toBe(true);
 expect(apiClient.post).not.toHaveBeenCalled();
});
it('consulta de nuevo al confirmar: si otro proceso consumió unidades, no publica', async () => {
 await montar(true); const boton = screen.getByRole('button', { name: 'Emitir Nota de Crédito' }) as HTMLButtonElement;
 await waitFor(() => expect(boton.disabled).toBe(false)); fireEvent.click(boton);
 expect(await screen.findByText(/La línea 1 supera las unidades disponibles del origen/)).toBeTruthy();
 expect(apiClient.post).not.toHaveBeenCalled();
});
it('el cliente rechaza una proyección vieja o cantidades inválidas', async () => {
 for (const cantidades_pendientes of [undefined, [{ codigo: 'X', original: 2, pendiente: -1 }]]) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 118, devuelto: 0, disponible: 118, cantidades_pendientes } });
  await expect(invoicesApi.getSaldoNota('origen')).rejects.toThrow('cantidades pendientes');
 }
});
