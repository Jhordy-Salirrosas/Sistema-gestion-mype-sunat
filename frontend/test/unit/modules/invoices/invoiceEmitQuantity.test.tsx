import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceIntegerInput } from '@/modules/invoices/components/InvoiceIntegerInput';
import { cantidadValidaParaUnidad, itemDesdeProducto, validarItems } from '@/modules/invoices/lib/invoiceItems';
import { erroresCamposLinea } from '@/modules/invoices/lib/invoiceLineFields';
import { problemasContenidoEmision } from '@/modules/invoices/lib/invoiceEmissionValidation';
afterEach(cleanup);
it.each(['NIU', 'BG', 'BX', 'PK', 'SET'])('%s solo admite enteros positivos en campo y validación previa al POST', unidad => {
  const item = { ...itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad, valorUnitario: 100, afectacion: '10' }, 'p'), cantidad: 3.002 };
  expect(cantidadValidaParaUnidad(3, unidad)).toBe(true);
  expect(cantidadValidaParaUnidad(0, unidad)).toBe(false);
  expect(cantidadValidaParaUnidad(3.002, unidad)).toBe(false);
  expect(erroresCamposLinea(item, false).cantidad).toContain('entera');
  expect(validarItems([item])[0].motivos).toContain('La cantidad debe ser entera y positiva para esta unidad.');
  expect(problemasContenidoEmision({ tipo: '01', clienteRazonSocial: 'Cliente', items: [item] }).some(e => e.includes('entera'))).toBe(true);
});
it.each(['ZZ', 'KGM', 'GRM', 'MTR', 'MTK', 'MTQ', 'LTR', 'GLL', 'TNE', 'DZN', 'CEN', 'MIL'])('conserva servicio/medida/agrupación %s con tres decimales', unidad => {
  const item = { ...itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad, valorUnitario: 100, afectacion: '10' }, 'p'), cantidad: 3.002 };
  expect(validarItems([item])).toEqual([]);
  expect(cantidadValidaParaUnidad(3.0002, unidad)).toBe(false);
});
it('no aplica la nueva regla a las cantidades históricas de notas', () => {
  expect(cantidadValidaParaUnidad(3.002, 'NIU', true)).toBe(true);
});
it('rechaza pegado decimal, signos y exponentes y normaliza 03 a 3', async () => {
  const onValue = vi.fn();
  render(<InvoiceIntegerInput aria-label="Cantidad" value={3} onValue={onValue} />);
  const input = screen.getByLabelText('Cantidad') as HTMLInputElement;
  for (const value of ['2.333', '-1', '1e3', '2,5']) {
    fireEvent.change(input, { target: { value } });
    expect(input.value).toBe('3');
  }
  expect(onValue).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '03' } });
  expect(input.value).toBe('3'); expect(onValue).toHaveBeenLastCalledWith(3);
  onValue.mockClear();
  const user = userEvent.setup(); await user.click(input); await user.keyboard('.');
  expect(input.value).toBe('3'); expect(onValue).not.toHaveBeenCalled();
});
