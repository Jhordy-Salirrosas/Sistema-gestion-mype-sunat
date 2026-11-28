vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:1000,precioUnitario:1180,afectacion:'10',stock:100,vendible:true}]) }));
import { validarCronograma } from '@/modules/invoices/lib/invoiceDetraccion';
import { calcularFlujo } from '@/modules/invoices/lib/invoiceFlujoPago';
import { calcularRetencion } from '@/modules/invoices/lib/invoiceRetentions';
import { cleanup } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { borradorConLinea as borradorInicial } from '../../../fixtures/invoiceEmissionProduct';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: [] })) } }));
afterEach(cleanup);

it.each([[118, 0], [700, 0], [701, 21.03], [1180, 35.4], [1770, 53.1]])('retiene sobre %s el importe %s', (total, esperado) => {
  expect(calcularRetencion(total, true)).toBe(esperado);
});

it('cuadra el cronograma con detracción y excluye retención simultánea', async () => {
  const base = borradorInicial('01', '2026-11-06');
  const b = { ...base, agenteRetencion: true, codigoDetraccion: '027', items: [{ ...base.items[0], valorUnitario: 1000, codigoDetraccion: '027' }] };
  const flujo = calcularFlujo(b);
  expect(flujo).toMatchObject({ importeTotal: 1180, detraccion: 47.2, neto: 1132.8 });
  expect(validarCronograma([{ monto: 566.4, vencimiento: '2026-12-06' }, { monto: 566.4, vencimiento: '2027-01-06' }], flujo.neto, b.fecha).cuadra).toBe(true);
});
