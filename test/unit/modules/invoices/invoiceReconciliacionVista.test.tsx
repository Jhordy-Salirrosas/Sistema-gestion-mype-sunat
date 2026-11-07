import { expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
import { InvoiceKpiCards } from '@/modules/invoices/components/InvoiceKpiCards';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { calcularResumenFiscal } from '@/modules/invoices/lib/invoiceMetrics';
import { aplicarFiltros } from '@/modules/invoices/lib/invoiceFilters';

it('reconcilia la tarjeta con las filas aceptadas visibles del mismo rango', () => {
  const item = (correlativo: number, base: number, fecha: string, estado: 'ACEPTADO' | 'SIN_CONFIRMAR') => construir({ tipo:'01', serie:'F001', correlativo, ruc:'20100070970', razonSocial:'Cliente', fecha, base, estado });
  const visibles = aplicarFiltros([item(1,1000,'2026-11-03','ACEPTADO'), item(2,500,'2026-11-03','ACEPTADO'), item(3,950,'2026-11-03','SIN_CONFIRMAR'), item(4,100,'2026-10-01','ACEPTADO')], { busqueda:'', estado:'TODOS', desde:'2026-11-03', hasta:'2026-11-03' });
  const { container } = render(<><InvoiceKpiCards resumen={calcularResumenFiscal(visibles)} /><InvoiceTable comprobantes={visibles} onVerXml={vi.fn()} onVerCdr={vi.fn()} onDescargarPdf={vi.fn()} onReintentarCdr={vi.fn()} /></>);
  const filas = within(container.querySelector('tbody')!).getAllByRole('row');
  const importe = (texto: string) => Number(texto.replace(/[^0-9.]/g, ''));
  const aceptadas = filas.filter((f) => within(f).queryByText('Aceptado'));
  const sumar = (columna: number) => aceptadas.reduce((s, fila) => s + importe(within(fila).getAllByRole('cell')[columna].textContent ?? ''), 0);
  const suma = sumar(7);
  expect(suma).toBe(1770);
  const cifra = within(container.querySelector('[data-kpi="total"]') as HTMLElement).getAllByText(/1,770\.00/)[0].textContent ?? '';
  expect(importe(cifra)).toBe(suma);
  const subtotales = within(container.querySelector('[data-kpi="total"]') as HTMLElement).getByText(/Base sin notas/).textContent ?? '';
  const valores = [...subtotales.matchAll(/S\/\s*([\d,]+\.\d{2})/g)].map((m) => importe(m[1]));
  expect(valores).toEqual([sumar(4), sumar(5)]);
});
