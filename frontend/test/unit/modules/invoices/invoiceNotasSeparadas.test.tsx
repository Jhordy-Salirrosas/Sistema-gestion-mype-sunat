import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceList } from '@/modules/invoices/InvoiceList';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import type { Invoice } from '@/modules/invoices/types/invoice.types';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({
  invoicesApi: { getInvoices: vi.fn(() => { throw new Error('No debe consultar la red'); }) },
}));

const fila = (id: string, tipo: string, serie: string, total: number, estado = 'ACEPTADO', fecha = '2026-11-01') => aInvoice({
  id, tipo_comprobante: tipo, serie, correlativo: 1, numero: `${serie}-00000001`,
  fecha_emision: fecha, estado, monto_total: total, moneda: 'PEN',
  cliente_documento: '20100070970', cliente_nombre: id, cdr_codigo: null, resultado_presentacion:estado==='RECHAZADO'?{origen:'SUNAT',codigo:'2000',motivo:'Rechazo SUNAT'}:undefined,
});
// Series deliberadamente invertidas: únicamente tipo_comprobante clasifica.
const credito = fila('cliente credito', '07', 'FD01', 118);
const debito = fila('cliente debito', '08', 'FC01', 59);
const factura = fila('cliente factura', '01', 'FC99', 1180);
const rechazada = fila('credito rechazado', '07', 'FD02', 236, 'RECHAZADO', '2026-10-01');

function montar(documentos: Invoice[] = [credito, debito, factura, rechazada]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(['invoices', 1], { data: documentos, totalPages: 1 });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/invoices/notas']}><InvoiceList /></MemoryRouter></QueryClientProvider>);
}
const seccion = (nombre: string) => within(screen.getByRole('region', { name: nombre }));
afterEach(cleanup);

describe('notas separadas en la bandeja real', () => {
  it('separa filas por tipo_comprobante, con conteos y subtotales fiscales', () => {
    montar();
    const creditos = seccion('Notas de crédito');
    const debitos = seccion('Notas de débito');
    expect(creditos.getByText('cliente credito')).toBeTruthy();
    expect(creditos.getByText('credito rechazado')).toBeTruthy();
    expect(creditos.queryByText('cliente debito')).toBeNull();
    expect(debitos.getByText('cliente debito')).toBeTruthy();
    expect(debitos.queryByText('cliente credito')).toBeNull();
    expect(screen.queryByText('cliente factura')).toBeNull();
    expect(creditos.getByText('2 documentos')).toBeTruthy();
    expect(debitos.getByText('1 documento')).toBeTruthy();
    expect(creditos.getByText('Total de notas de crédito: S/ 118.00')).toBeTruthy();
    expect(debitos.getByText('Total de notas de débito: S/ 59.00')).toBeTruthy();
    expect(creditos.getByRole('table')).toBeTruthy();
    expect(debitos.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Notas/ })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('conserva la sección de débito vacía con conteo e importe cero', () => {
    montar([credito]);
    const debitos = seccion('Notas de débito');
    expect(debitos.getByText('0 documentos')).toBeTruthy();
    expect(debitos.getByText('No hay notas de débito con los filtros aplicados.')).toBeTruthy();
    expect(debitos.getByText('Total de notas de débito: S/ 0.00')).toBeTruthy();
  });

  it('muestra también el vacío explícito de crédito', () => {
    montar([debito]);
    expect(seccion('Notas de crédito').getByText('No hay notas de crédito con los filtros aplicados.')).toBeTruthy();
    expect(seccion('Notas de crédito').getByText('Total de notas de crédito: S/ 0.00')).toBeTruthy();
  });

  it('busca cada tipo sin contaminar filas, conteos ni subtotales del otro', () => {
    montar();
    const buscar = screen.getByLabelText('Buscar comprobantes');
    fireEvent.change(buscar, { target: { value: 'cliente debito' } });
    expect(seccion('Notas de crédito').getByText('0 documentos')).toBeTruthy();
    expect(seccion('Notas de crédito').getByText('Total de notas de crédito: S/ 0.00')).toBeTruthy();
    expect(seccion('Notas de débito').getByText('cliente debito')).toBeTruthy();
    fireEvent.change(buscar, { target: { value: 'cliente credito' } });
    expect(seccion('Notas de crédito').getByText('cliente credito')).toBeTruthy();
    expect(seccion('Notas de débito').getByText('0 documentos')).toBeTruthy();
    expect(seccion('Notas de débito').getByText('Total de notas de débito: S/ 0.00')).toBeTruthy();
  });

  it('aplica el rango de fechas a ambas secciones antes de contarlas', () => {
    montar();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    expect(seccion('Notas de crédito').getByText('1 documento')).toBeTruthy();
    expect(screen.queryByText('credito rechazado')).toBeNull();
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-30' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-02' } });
    expect(seccion('Notas de crédito').getByText('0 documentos')).toBeTruthy();
    expect(seccion('Notas de débito').getByText('0 documentos')).toBeTruthy();
  });
  it('filtra por estado sin mezclar crédito rechazado con débito aceptado', () => {
    montar();
    fireEvent.keyDown(screen.getByLabelText('Filtrar por estado CDR'), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Rechazado (SUNAT)' }));
    expect(seccion('Notas de crédito').getByText('credito rechazado')).toBeTruthy();
    expect(seccion('Notas de crédito').getByText('1 documento')).toBeTruthy();
    expect(seccion('Notas de crédito').queryByText('cliente credito')).toBeNull();
    expect(seccion('Notas de débito').getByText('0 documentos')).toBeTruthy();
    expect(seccion('Notas de débito').getByText('Total de notas de débito: S/ 0.00')).toBeTruthy();
  });
});
