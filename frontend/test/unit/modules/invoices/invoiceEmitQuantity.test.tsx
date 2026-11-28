import { afterEach, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { cantidadValidaParaUnidad, itemDesdeProducto, validarItems } from '@/modules/invoices/lib/invoiceItems';
import { erroresCamposLinea } from '@/modules/invoices/lib/invoiceLineFields';
import { problemasContenidoEmision } from '@/modules/invoices/lib/invoiceEmissionValidation';
afterEach(cleanup);
it.each(['NIU', 'BG', 'BX', 'PK', 'SET'])('el validador de la unidad discreta %s conserva su regla de enteros positivos', unidad => {
  const item = { ...itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad, valorUnitario: 100, afectacion: '10' }, 'p'), cantidad: 3.002 };
  expect(cantidadValidaParaUnidad(3, unidad)).toBe(true);
  expect(cantidadValidaParaUnidad(0, unidad)).toBe(false);
  expect(cantidadValidaParaUnidad(3.002, unidad)).toBe(false);
  expect(erroresCamposLinea(item, false).cantidad).toContain('entera');
  expect(validarItems([item])[0].motivos).toContain('La cantidad debe ser entera y positiva para esta unidad.');
  expect(problemasContenidoEmision({ tipo: '01', clienteRazonSocial: 'Cliente', items: [item] }).some(e => e.includes('entera'))).toBe(true);
});
it.each(['ZZ', 'KGM', 'GRM', 'MTR', 'MTK', 'MTQ', 'LTR', 'GLL', 'TNE', 'DZN', 'CEN', 'MIL'])('el dominio histórico conserva la precisión de servicio/medida/agrupación %s', unidad => {
  const item = { ...itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad, valorUnitario: 100, afectacion: '10' }, 'p'), cantidad: 3.002 };
  expect(validarItems([item])).toEqual([]);
  expect(cantidadValidaParaUnidad(3.0002, unidad)).toBe(false);
});
it('la validación del origen mantiene sus cantidades históricas; la grilla normaliza su edición por separado', () => {
  expect(cantidadValidaParaUnidad(3.002, 'NIU', true)).toBe(true);
});
